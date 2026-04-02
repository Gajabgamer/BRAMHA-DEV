function invokeController(handler, req) {
  return new Promise((resolve, reject) => {
    const response = {
      statusCode: 200,
      headersSent: false,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.headersSent = true;
        if (this.statusCode >= 400) {
          const error = new Error(payload?.error || `Controller request failed with ${this.statusCode}.`);
          error.statusCode = this.statusCode;
          error.payload = payload;
          reject(error);
          return this;
        }

        resolve({
          statusCode: this.statusCode,
          payload,
        });
        return this;
      },
      redirect(location) {
        resolve({
          statusCode: this.statusCode || 302,
          payload: { redirectTo: location },
        });
        return this;
      },
    };

    Promise.resolve(handler(req, response)).catch(reject);
  });
}

module.exports = {
  invokeController,
};
