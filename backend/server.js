const app = require('./app');
const { initializeEventBus } = require('./lib/eventBus');

const PORT = process.env.PORT || 8000;
initializeEventBus();
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
