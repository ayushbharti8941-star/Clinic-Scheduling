const express = require("express");
const cors = require("cors");
require("dotenv").config();
const appointmentsRouter = require("./routes/appointments");
const notesRouter = require("./routes/notes");
const providersRouter = require("./routes/providers");
const dashboardRouter = require("./routes/dashboard");

const authRouter = require("./routes/auth");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Clinic Scheduling API is running",
  });
});

app.use("/api/auth", authRouter);
app.use("/api/appointments", appointmentsRouter);
app.use("/api/providers", providersRouter);
app.use("/api", notesRouter);
app.use("/api/dashboard", dashboardRouter);

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});