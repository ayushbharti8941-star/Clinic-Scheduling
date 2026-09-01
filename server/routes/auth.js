const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const {
  authenticateToken,
  requireRole,
} = require("../middleware/auth");

const prisma = require("../lib/prisma");

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "8h",
      }
    );

    let provider = null;
    if (user.role === "PROVIDER") {
      provider = await prisma.provider.findUnique({
        where: { userId: user.id },
        select: { id: true, name: true },
      });
    }

    return res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        providerId: provider?.id ?? null,
        providerName: provider?.name ?? null,
      },
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
});
router.get(
  "/front-desk-test",
  authenticateToken,
  requireRole("FRONT_DESK"),
  (req, res) => {
    res.json({
      message: "You have front desk access",
      user: req.user,
    });
  }
);

module.exports = router;