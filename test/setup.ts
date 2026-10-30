// Loaded before unit tests: provide the env the config module validates, without touching a database.
process.env.NODE_ENV ??= "test";
process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/doctor-tracker-test";
process.env.JWT_SECRET ??= "test-secret-test-secret-test-secret-123456";
process.env.CLIENT_URL ??= "http://localhost:1982";
