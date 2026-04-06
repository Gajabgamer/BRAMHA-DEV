const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const User = require("./backend/models/User");
require("dotenv").config({ path: "./backend/.env" });

async function resetAdmin() {
  await mongoose.connect(process.env.MONGO_URI);
  const passwordHash = await bcrypt.hash("22Nov@2007", 10);
  const user = await User.findOneAndUpdate(
    { email: "admin@gmail.com" },
    { passwordHash, name: "Admin" },
    { upsert: true, new: true }
  );
  console.log("Admin user stored:", user.email);
  process.exit(0);
}
resetAdmin();
