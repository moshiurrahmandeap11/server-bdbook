import bcrypt from "bcrypt";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { db } from "../../database/db.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const users = await db
      .collection("users")
      .find({}, { projection: { password: 0 } })
      .toArray();

    res.json({
      success: true,
      message: "Users fetched successfully",
      data: users,
    });
  } catch (error) {
    console.error("Failed to fetching users : ", error);
    res.status(500).json({
      success: false,
      message: "Unable to fetched users data",
    });
  }
});

// login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // validation
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email required for login",
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password required for login",
      });
    }

    // find user in database
    const user = await db.collection("users").findOne({ email });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credintials",
      });
    }

    // compare password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid password",
      });
    }

    // create jwt
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role || "user" },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES },
    );

    // try to set cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Failed to login : ", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// sign up
router.post("/signup", async (req, res) => {
  try {
    const { email, password, fullName, gender, dob } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email required for sign up",
      });
    }
    if (!password) {
      return res.status(400).json({
        success: false,
        message: "password required for sign up",
      });
    }
    if (!fullName) {
      return res.status(400).json({
        success: false,
        message: "full name required for sign up",
      });
    }
    if (!gender) {
      return res.status(400).json({
        success: false,
        message: "gender required for sign up",
      });
    }
    if (!dob) {
      return res.status(400).json({
        success: false,
        message: "dob required for sign up",
      });
    }

    const emailRegex = /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/;
if (!emailRegex.test(email)) {
  return res.status(400).json({
    success: false,
    message: "Invalid email format"
  });
}

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const emailLower = email.toLowerCase();

    // check existing
    const existingUser = await db
      .collection("users")
      .findOne({ email: emailLower });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

await db.collection("users").insertOne({
  email: emailLower,
  password: hashedPassword,
  role: "user",
  fullName: fullName || "",
  gender: gender,
  dob: new Date(dob), // Store as Date object
  createdAt: new Date(),
  updatedAt: new Date(),
});

    res.status(201).json({
      success: true,
      message: "account created successfully",
    });
  } catch (error) {
    console.error("sign up error : ", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});


// log out
router.post("/logout", async(req, res) => {
    try {
        res.clearCookie("token", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        });

        res.json({
            success: true,
            message: "Logged out successfully",
        })
    } catch (error) {
        console.error("log out failed : ", error);
        res.status(500).json({
            success: false,
            message: "server error",
        })
    }
})

export default router;
