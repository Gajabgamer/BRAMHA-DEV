import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import * as acorn from "acorn";
import * as walk from "acorn-walk";
import db from "./src/services/db.js";
import { analyzeCodeLocally, generateProjectName } from "./src/services/analyzer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || "bug-predictor-secret-key-2026";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '500kb' }));
  app.use(cookieParser());

  // Helper for logging
  const logAction = (userId: number | null, action: string, details: string, ip: string, endpoint?: string, status?: number) => {
    try {
      db.prepare('INSERT INTO logs (user_id, action, details, ip, endpoint, status) VALUES (?, ?, ?, ?, ?, ?)').run(userId, action, details, ip, endpoint, status);
    } catch (err) {
      console.error("Failed to log action:", err);
    }
  };

  const notifyUser = (userId: number, message: string, type: string = 'info') => {
    try {
      db.prepare('INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)').run(userId, message, type);
    } catch (err) {
      console.error("Failed to notify user:", err);
    }
  };

  // Auth Middleware
  const verifyToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.cookies.token;

    // Handle cases where token might be "undefined" or "null" as a string
    if (token === 'undefined' || token === 'null') {
      token = null;
    }

    if (!token) {
      return res.status(401).json({ error: "Unauthorized: Missing token" });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      req.user = decoded;
      next();
    } catch (err: any) {
      console.error("Token verification error:", err.message);
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: "Session expired, please login again" });
      }
      res.status(403).json({ error: "Forbidden: Invalid token" });
    }
  };

  const verifyAdmin = (req: any, res: any, next: any) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: "Forbidden: Admins only" });
    }
    next();
  };

  // Simple Rate Limiting
  const requestCounts = new Map<string, { count: number, resetTime: number }>();
  const RATE_LIMIT = 100; // increased for multi-user
  const WINDOW_SIZE = 60 * 1000;

  app.use((req, res, next) => {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    const userLimit = requestCounts.get(ip);
    if (userLimit && now < userLimit.resetTime) {
      if (userLimit.count >= RATE_LIMIT) return res.status(429).json({ error: "Too many requests" });
      userLimit.count++;
    } else {
      requestCounts.set(ip, { count: 1, resetTime: now + WINDOW_SIZE });
    }
    next();
  });

  // Auth Routes
  app.post("/api/auth/register", async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: "All fields are required" });
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any).count;
      const role = userCount === 0 ? 'admin' : 'user';
      const info = db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)').run(name, email, hashedPassword, role);
      const userId = info.lastInsertRowid as number;
      
      db.prepare(`
        INSERT INTO settings (user_id, profile_name, profile_email, profile_bio, two_factor, biometric, session_timeout, api_keys)
        VALUES (?, ?, ?, ?, 0, 0, '30m', '[]')
      `).run(userId, name, email, '');

      logAction(userId, 'REGISTER', 'User registered', req.ip || 'unknown');
      res.json({ success: true });
    } catch (err: any) {
      if (err.message.includes('UNIQUE')) return res.status(400).json({ error: "Email already exists" });
      res.status(500).json({ error: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    try {
      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '24h' });
      res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 24 * 60 * 60 * 1000 });
      logAction(user.id, 'LOGIN', 'User logged in', req.ip || 'unknown');
      res.json({ 
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        token 
      });
    } catch (err) {
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie('token');
    res.json({ success: true });
  });

  app.get("/api/auth/me", verifyToken, (req: any, res) => {
    res.json({ user: req.user });
  });

  // Analysis Queue
  const analysisQueue = new Map<string, { status: 'processing' | 'completed', result?: any }>();

  // 1. Analyze API
  app.post("/api/analyze", verifyToken, (req: any, res) => {
    try {
      const { code, name: manualName, language, async = false } = req.body;
      if (!code) return res.status(400).json({ error: "Code is required" });

      const result = analyzeCodeLocally(code, undefined, language);
      const projectName = manualName || result.projectName || generateProjectName(code, result.language);

      // Validation before saving
      if (!projectName || !Array.isArray(result.issues) || typeof result.risk_score !== 'number') {
        console.error("[SERVER] Validation failed for analysis result", { projectName, issues: !!result.issues, risk_score: result.risk_score });
        return res.status(500).json({ error: "Invalid analysis result generated" });
      }

      if (async) {
        const jobId = Math.random().toString(36).substring(7);
        analysisQueue.set(jobId, { status: 'processing' });
        setTimeout(() => {
          db.prepare(`
            INSERT INTO analyses (user_id, name, code, risk_score, status, result)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(req.user.id, projectName, code, result.risk_score, result.riskLevel, JSON.stringify(result));
          analysisQueue.set(jobId, { status: 'completed', result });
          
          notifyUser(req.user.id, `Analysis completed for ${projectName}. Risk: ${result.riskLevel}`, result.riskLevel === 'High' ? 'warning' : 'success');
          logAction(req.user.id, 'ANALYZE_ASYNC', `Analyzed: ${projectName}`, req.ip || 'unknown', '/api/analyze', 200);
        }, 2000);
        return res.json({ jobId, status: 'processing' });
      }

      const info = db.prepare(`
        INSERT INTO analyses (user_id, name, code, risk_score, status, result)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(req.user.id, projectName, code, result.risk_score, result.riskLevel, JSON.stringify(result));
      
      notifyUser(req.user.id, `Analysis completed for ${projectName}. Risk: ${result.riskLevel}`, result.riskLevel === 'High' ? 'warning' : 'success');
      logAction(req.user.id, 'ANALYZE', `Analyzed: ${projectName}`, req.ip || 'unknown', '/api/analyze', 200);
      
      // Debug Mode Logging
      console.log(`[DEBUG] Analysis Saved: ${projectName}, Risk: ${result.risk_score}, Issues: ${result.issues.length}`);
      
      res.json({ id: info.lastInsertRowid, projectName, ...result });
    } catch (err) {
      console.error("[SERVER] Analysis Error:", err);
      res.status(500).json({ error: "Analysis failed" });
    }
  });

  app.get("/api/analyze/status/:jobId", verifyToken, (req, res) => {
    const job = analysisQueue.get(req.params.jobId);
    if (!job) return res.status(404).json({ error: "Job not found" });
    res.json(job);
  });

  // 2. History API
  app.get("/api/history", verifyToken, (req: any, res) => {
    try {
      const rows = db.prepare('SELECT * FROM analyses WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id) as any[];
      const history = rows.map(row => ({
        id: row.id,
        name: row.name,
        date: new Date(row.created_at).toLocaleString(),
        score: row.risk_score,
        status: row.status,
        code: row.code,
        result: JSON.parse(row.result)
      }));
      res.json(history);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch history" });
    }
  });

  app.delete("/api/history/:id", verifyToken, (req: any, res) => {
    try {
      const result = db.prepare('DELETE FROM analyses WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
      if (result.changes === 0) return res.status(404).json({ error: "Not found" });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete" });
    }
  });

  // 3. Settings API
  app.get("/api/settings", verifyToken, (req: any, res) => {
    try {
      const row = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(req.user.id) as any;
      if (!row) return res.status(404).json({ error: "Settings not found" });
      res.json({
        profile: { name: row.profile_name, email: row.profile_email, bio: row.profile_bio },
        security: { twoFactor: !!row.two_factor, biometric: !!row.biometric, sessionTimeout: row.session_timeout },
        apiKeys: JSON.parse(row.api_keys)
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.post("/api/settings", verifyToken, (req: any, res) => {
    try {
      const { profile, security, apiKeys } = req.body;
      db.prepare(`
        UPDATE settings 
        SET profile_name = ?, profile_email = ?, profile_bio = ?, 
            two_factor = ?, biometric = ?, session_timeout = ?, 
            api_keys = ?
        WHERE user_id = ?
      `).run(profile.name, profile.email, profile.bio, security.twoFactor ? 1 : 0, security.biometric ? 1 : 0, security.sessionTimeout, JSON.stringify(apiKeys), req.user.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  // 4. Admin APIs
  app.get("/api/admin/stats", verifyToken, verifyAdmin, (req, res) => {
    try {
      const totalUsers = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any).count;
      const totalAnalyses = (db.prepare('SELECT COUNT(*) as count FROM analyses').get() as any).count;
      const avgRiskScore = (db.prepare('SELECT AVG(risk_score) as avg FROM analyses').get() as any).avg || 0;
      const activeUsers = (db.prepare('SELECT COUNT(DISTINCT user_id) as count FROM analyses WHERE created_at > datetime("now", "-7 days")').get() as any).count;
      
      const riskTrends = db.prepare(`
        SELECT date(created_at) as date, COUNT(*) as count 
        FROM analyses 
        GROUP BY date(created_at) 
        ORDER BY date ASC 
        LIMIT 7
      `).all();

      const riskDistribution = [
        { name: 'Low', count: (db.prepare('SELECT COUNT(*) as count FROM analyses WHERE risk_score <= 30').get() as any).count },
        { name: 'Med', count: (db.prepare('SELECT COUNT(*) as count FROM analyses WHERE risk_score > 30 AND risk_score <= 70').get() as any).count },
        { name: 'High', count: (db.prepare('SELECT COUNT(*) as count FROM analyses WHERE risk_score > 70').get() as any).count }
      ];

      res.json({ totalUsers, totalAnalyses, avgRiskScore: Math.round(avgRiskScore), activeUsers, riskTrends, riskDistribution });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.get("/api/admin/users", verifyToken, verifyAdmin, (req, res) => {
    const users = db.prepare('SELECT id, name, email, role, created_at FROM users').all();
    res.json(users);
  });

  app.patch("/api/admin/users/:id/role", verifyToken, verifyAdmin, (req, res) => {
    const { role } = req.body;
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/admin/users/:id", verifyToken, verifyAdmin, (req: any, res) => {
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    logAction(req.user.id, 'ADMIN_DELETE_USER', `Deleted user ID: ${req.params.id}`, req.ip || 'unknown');
    res.json({ success: true });
  });

  app.get("/api/admin/analyses", verifyToken, verifyAdmin, (req, res) => {
    const analyses = db.prepare(`
      SELECT a.*, u.name as user_name 
      FROM analyses a 
      JOIN users u ON a.user_id = u.id 
      ORDER BY a.created_at DESC
    `).all();
    res.json(analyses.map((a: any) => ({ ...a, result: JSON.parse(a.result) })));
  });

  app.delete("/api/admin/analyses/:id", verifyToken, verifyAdmin, (req: any, res) => {
    db.prepare('DELETE FROM analyses WHERE id = ?').run(req.params.id);
    logAction(req.user.id, 'ADMIN_DELETE_ANALYSIS', `Deleted analysis ID: ${req.params.id}`, req.ip || 'unknown');
    res.json({ success: true });
  });

  app.get("/api/admin/logs", verifyToken, verifyAdmin, (req, res) => {
    const logs = db.prepare(`
      SELECT l.*, u.name as user_name 
      FROM logs l 
      LEFT JOIN users u ON l.user_id = u.id 
      ORDER BY l.created_at DESC 
      LIMIT 100
    `).all();
    res.json(logs);
  });

  // 5. Analytics API
  app.get("/api/analytics", verifyToken, (req: any, res) => {
    try {
      const riskTrends = db.prepare(`
        SELECT date(created_at) as date, AVG(risk_score) as avgScore 
        FROM analyses 
        WHERE user_id = ? 
        GROUP BY date(created_at) 
        ORDER BY date ASC 
        LIMIT 30
      `).all(req.user.id);
      
      const commonIssues = db.prepare(`
        SELECT result FROM analyses WHERE user_id = ?
      `).all(req.user.id);
      
      const issueCounts: Record<string, number> = {};
      commonIssues.forEach((row: any) => {
        const result = JSON.parse(row.result);
        const issues = result.issues || result.anomalies || [];
        issues.forEach((a: any) => {
          issueCounts[a.category] = (issueCounts[a.category] || 0) + 1;
        });
      });

      res.json({ riskTrends, issueCounts });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // 6. Notifications API
  app.get("/api/notifications", verifyToken, (req: any, res) => {
    try {
      const notifications = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(req.user.id);
      res.json(notifications);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.patch("/api/notifications/read", verifyToken, (req: any, res) => {
    try {
      db.prepare('UPDATE notifications SET read_status = 1 WHERE user_id = ?').run(req.user.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update notifications" });
    }
  });

  // 7. Dependency Analysis API
  app.post("/api/dependencies/analyze", verifyToken, (req: any, res) => {
    try {
      const { packageJson } = req.body;
      let pkg;
      try {
        pkg = JSON.parse(packageJson);
      } catch (e) {
        return res.status(400).json({ error: "Invalid package.json" });
      }

      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      const result = Object.keys(deps).map(name => {
        const version = deps[name];
        // Mock vulnerability data
        const vulnerabilities = [
          { name: 'lodash', level: 'High', cve: 'CVE-2020-8203', suggestion: 'Upgrade to 4.17.20+' },
          { name: 'axios', level: 'Medium', cve: 'CVE-2021-3749', suggestion: 'Upgrade to 0.21.2+' },
          { name: 'express', level: 'Low', cve: 'CVE-2022-24999', suggestion: 'Upgrade to 4.18.0+' }
        ];
        const vuln = vulnerabilities.find(v => name.includes(v.name));
        
        return {
          name,
          version,
          vulnerability: vuln ? { level: vuln.level, cve: vuln.cve, suggestion: vuln.suggestion } : null
        };
      });

      res.json(result);
    } catch (err) {
      res.status(500).json({ error: "Dependency analysis failed" });
    }
  });

  // 8. Live Trace API
  app.post("/api/trace/analyze", verifyToken, (req: any, res) => {
    try {
      const { code } = req.body;
      const ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
      const steps: any[] = [];
      let stepId = 1;

      walk.simple(ast, {
        VariableDeclarator(node: any) {
          steps.push({
            id: stepId++,
            line: node.loc.start.line,
            action: 'Variable Declaration',
            details: `Defining ${node.id.name}`,
            variables: { [node.id.name]: 'initialized' }
          });
        },
        CallExpression(node: any) {
          steps.push({
            id: stepId++,
            line: node.loc.start.line,
            action: 'Function Call',
            details: `Calling ${node.callee.name || 'anonymous function'}`,
            variables: {}
          });
        },
        IfStatement(node: any) {
          steps.push({
            id: stepId++,
            line: node.loc.start.line,
            action: 'Conditional Branch',
            details: `Evaluating condition`,
            variables: {}
          });
        },
        AssignmentExpression(node: any) {
          steps.push({
            id: stepId++,
            line: node.loc.start.line,
            action: 'Variable Assignment',
            details: `Updating ${node.left.name}`,
            variables: { [node.left.name]: 'updated' }
          });
        }
      });

      res.json(steps.slice(0, 50)); // Limit steps
    } catch (err) {
      res.status(500).json({ error: "Trace analysis failed" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
});
