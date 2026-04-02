import bcrypt from "bcrypt";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { db } from "../../database/db.js";
import {
  coverPhotoUpload,
  deleteFromCloudinary,
  getOptimizedUrl,
  profilePictureUpload
} from "../../middleware/upload.js";

const router = Router();

// ==================== MIDDLEWARE ====================
// Authentication middleware
const authenticateToken = (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.split(" ")[1];
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access denied. No token provided."
    });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: "Invalid or expired token"
    });
  }
};

// ==================== GET ALL USERS ====================
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;
    
    const query = search ? {
      $or: [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ]
    } : {};
    
    const users = await db
      .collection("users")
      .find(query, { projection: { password: 0 } })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 })
      .toArray();
    
    const total = await db.collection("users").countDocuments(query);
    
    res.json({
      success: true,
      message: "Users fetched successfully",
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Failed to fetch users:", error);
    res.status(500).json({
      success: false,
      message: "Unable to fetch users data"
    });
  }
});

// ==================== GET USER BY ID ====================
router.get("/id/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }
    
    const user = await db
      .collection("users")
      .findOne({ _id: new ObjectId(id) }, { projection: { password: 0 } });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    res.status(200).json({
      success: true,
      message: "User fetched successfully",
      data: user,
    });
  } catch (error) {
    console.error("User fetching error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// ==================== GET USER BY EMAIL ====================
router.get("/email/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const emailLower = email.toLowerCase();
    
    const user = await db
      .collection("users")
      .findOne({ email: emailLower }, { projection: { password: 0 } });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    res.status(200).json({
      success: true,
      message: "User fetched successfully",
      data: user,
    });
  } catch (error) {
    console.error("User fetching error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// ==================== GET CURRENT USER ====================
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const user = await db
      .collection("users")
      .findOne({ _id: new ObjectId(req.user.id) }, { projection: { password: 0 } });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    res.json({
      success: true,
      message: "User fetched successfully",
      data: user
    });
  } catch (error) {
    console.error("Current user fetch error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// ==================== UPDATE USER (PATCH) ====================
router.patch("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Check if user is updating their own profile
    if (req.user.id !== id && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "You can only update your own profile"
      });
    }
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }
    
    // Remove sensitive fields that shouldn't be updated directly
    const forbiddenUpdates = ["_id", "password", "email", "role", "createdAt"];
    forbiddenUpdates.forEach(field => delete updates[field]);
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields to update"
      });
    }
    
    // Add updatedAt timestamp
    updates.updatedAt = new Date();
    
    // If updating fullName, trim it
    if (updates.fullName) {
      updates.fullName = updates.fullName.trim();
    }
    
    const result = await db
      .collection("users")
      .updateOne(
        { _id: new ObjectId(id) },
        { $set: updates }
      );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    // Get updated user
    const updatedUser = await db
      .collection("users")
      .findOne({ _id: new ObjectId(id) }, { projection: { password: 0 } });
    
    res.json({
      success: true,
      message: "User updated successfully",
      data: updatedUser
    });
  } catch (error) {
    console.error("User update error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// ==================== DELETE USER ====================
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check authorization
    if (req.user.id !== id && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own account"
      });
    }
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }
    
    // Get user before deletion to clean up their files
    const user = await db.collection("users").findOne({ _id: new ObjectId(id) });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    // Delete user's media from Cloudinary
    if (user.profilePicture?.publicId) {
      await deleteFromCloudinary(user.profilePicture.publicId, 'image');
    }
    if (user.coverPhoto?.publicId) {
      await deleteFromCloudinary(user.coverPhoto.publicId, 'image');
    }
    
    // Delete user's posts and other data
    await db.collection("posts").deleteMany({ userId: id });
    await db.collection("stories").deleteMany({ userId: id });
    await db.collection("messages").deleteMany({ $or: [{ senderId: id }, { receiverId: id }] });
    
    // Delete user
    const result = await db.collection("users").deleteOne({ _id: new ObjectId(id) });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    // Clear token cookie if deleting own account
    if (req.user.id === id) {
      res.clearCookie("token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      });
    }
    
    res.json({
      success: true,
      message: "User account deleted successfully"
    });
  } catch (error) {
    console.error("User deletion error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// In users.js, update the upload endpoints:

// In users.js, update the upload endpoints with more detailed error handling:

// ==================== UPLOAD PROFILE PICTURE ====================
router.post("/upload-profile-pic", authenticateToken, (req, res) => {
  profilePictureUpload.single("profilePic")(req, res, async (err) => {
    try {
      console.log("Profile upload request received");
      
      // Handle multer errors
      if (err) {
        console.error("Multer error:", err);
        return res.status(400).json({
          success: false,
          message: err.message || "File upload error"
        });
      }
      
      console.log("File:", req.file);
      
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded"
        });
      }
      
      const userId = req.user.id;
      console.log("User ID:", userId);
      
      const user = await db.collection("users").findOne({ _id: new ObjectId(userId) });
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }
      
      // Delete old profile picture if exists
      if (user?.profilePicture?.publicId) {
        try {
          await deleteFromCloudinary(user.profilePicture.publicId, 'image');
        } catch (deleteError) {
          console.error("Error deleting old profile picture:", deleteError);
          // Continue even if delete fails
        }
      }
      
      // Update user with new profile picture
      const updateData = {
        profilePicture: {
          url: req.file.path,
          publicId: req.file.filename,
          optimizedUrl: getOptimizedUrl(req.file.filename, { width: 200, height: 200, crop: 'fill' }),
          uploadedAt: new Date()
        },
        updatedAt: new Date()
      };
      
      const result = await db.collection("users").updateOne(
        { _id: new ObjectId(userId) },
        { $set: updateData }
      );
      
      console.log("Database update result:", result);
      
      res.json({
        success: true,
        message: "Profile picture uploaded successfully",
        data: updateData.profilePicture
      });
    } catch (error) {
      console.error("Profile picture upload error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to upload profile picture"
      });
    }
  });
});

// ==================== UPLOAD COVER PHOTO ====================
router.post("/upload-cover-photo", authenticateToken, (req, res) => {
  coverPhotoUpload.single("coverPhoto")(req, res, async (err) => {
    try {
      console.log("Cover upload request received");
      
      // Handle multer errors
      if (err) {
        console.error("Multer error:", err);
        return res.status(400).json({
          success: false,
          message: err.message || "File upload error"
        });
      }
      
      console.log("File:", req.file);
      
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded"
        });
      }
      
      const userId = req.user.id;
      console.log("User ID:", userId);
      
      const user = await db.collection("users").findOne({ _id: new ObjectId(userId) });
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }
      
      // Delete old cover photo if exists
      if (user?.coverPhoto?.publicId) {
        try {
          await deleteFromCloudinary(user.coverPhoto.publicId, 'image');
        } catch (deleteError) {
          console.error("Error deleting old cover photo:", deleteError);
          // Continue even if delete fails
        }
      }
      
      // Update user with new cover photo
      const updateData = {
        coverPhoto: {
          url: req.file.path,
          publicId: req.file.filename,
          optimizedUrl: getOptimizedUrl(req.file.filename, { width: 1200, height: 400, crop: 'fill' }),
          uploadedAt: new Date()
        },
        updatedAt: new Date()
      };
      
      const result = await db.collection("users").updateOne(
        { _id: new ObjectId(userId) },
        { $set: updateData }
      );
      
      console.log("Database update result:", result);
      
      res.json({
        success: true,
        message: "Cover photo uploaded successfully",
        data: updateData.coverPhoto
      });
    } catch (error) {
      console.error("Cover photo upload error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to upload cover photo"
      });
    }
  });
});

// ==================== REMOVE PROFILE PICTURE ====================
router.delete("/remove-profile-pic", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await db.collection("users").findOne({ _id: new ObjectId(userId) });
    
    if (!user?.profilePicture?.publicId) {
      return res.status(404).json({
        success: false,
        message: "No profile picture found"
      });
    }
    
    // Delete from Cloudinary
    await deleteFromCloudinary(user.profilePicture.publicId, 'image');
    
    // Remove from database
    await db.collection("users").updateOne(
      { _id: new ObjectId(userId) },
      { 
        $unset: { profilePicture: "" },
        $set: { updatedAt: new Date() }
      }
    );
    
    res.json({
      success: true,
      message: "Profile picture removed successfully"
    });
  } catch (error) {
    console.error("Profile picture removal error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove profile picture"
    });
  }
});

// ==================== REMOVE COVER PHOTO ====================
router.delete("/remove-cover-photo", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await db.collection("users").findOne({ _id: new ObjectId(userId) });
    
    if (!user?.coverPhoto?.publicId) {
      return res.status(404).json({
        success: false,
        message: "No cover photo found"
      });
    }
    
    // Delete from Cloudinary
    await deleteFromCloudinary(user.coverPhoto.publicId, 'image');
    
    // Remove from database
    await db.collection("users").updateOne(
      { _id: new ObjectId(userId) },
      { 
        $unset: { coverPhoto: "" },
        $set: { updatedAt: new Date() }
      }
    );
    
    res.json({
      success: true,
      message: "Cover photo removed successfully"
    });
  } catch (error) {
    console.error("Cover photo removal error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove cover photo"
    });
  }
});

// ==================== CHANGE PASSWORD ====================
router.post("/change-password", authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required"
      });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters"
      });
    }
    
    const user = await db.collection("users").findOne({ _id: new ObjectId(userId) });
    
    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect"
      });
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password
    await db.collection("users").updateOne(
      { _id: new ObjectId(userId) },
      { 
        $set: { 
          password: hashedPassword,
          updatedAt: new Date()
        }
      }
    );
    
    res.json({
      success: true,
      message: "Password changed successfully"
    });
  } catch (error) {
    console.error("Password change error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// ==================== SEARCH USERS ====================
router.get("/search/:query", async (req, res) => {
  try {
    const { query } = req.params;
    const { limit = 20 } = req.query;
    
    if (!query || query.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Search query must be at least 2 characters"
      });
    }
    
    const users = await db
      .collection("users")
      .find({
        $or: [
          { fullName: { $regex: query, $options: "i" } },
          { email: { $regex: query, $options: "i" } }
        ]
      })
      .project({ password: 0 })
      .limit(parseInt(limit))
      .toArray();
    
    res.json({
      success: true,
      message: "Users found",
      data: users,
      count: users.length
    });
  } catch (error) {
    console.error("User search error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// ==================== LOGIN ====================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    const user = await db.collection("users").findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    const token = jwt.sign(
      { id: user._id.toString(), email: user.email, role: user.role || "user" },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES || "7d" }
    );

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
        name: user.fullName,
        email: user.email,
        role: user.role,
        profilePicture: user.profilePicture,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// ==================== SIGNUP ====================
router.post("/signup", async (req, res) => {
  try {
    const { email, password, fullName, gender, dob } = req.body;

    // Validation
    if (!email || !password || !fullName || !gender || !dob) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
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
        message: "Password must be at least 6 characters"
      });
    }

    const emailLower = email.toLowerCase();

    const existingUser = await db
      .collection("users")
      .findOne({ email: emailLower });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User already exists"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
      email: emailLower,
      password: hashedPassword,
      role: "user",
      fullName: fullName.trim(),
      gender: gender,
      dob: new Date(dob),
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      isVerified: false,
    };

    await db.collection("users").insertOne(newUser);

    res.status(201).json({
      success: true,
      message: "Account created successfully",
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// ==================== LOGOUT ====================
router.post("/logout", async (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    });

    res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

export default router;