import { Router } from "express";
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { db } from "../../database/db.js";
import { postUpload } from "../../middleware/upload.js";
import { createNotification } from "../notificationRoute/notificationRoutes.js";


const router = Router();

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


// In postRoutes.js, update the CREATE POST endpoint:

// ==================== CREATE POST ====================
router.post("/create", authenticateToken, (req, res) => {
  postUpload.single("media")(req, res, async (err) => {
    try {
      console.log("Create post request received");
      console.log("Request body:", req.body);
      console.log("Request file:", req.file);
      
      // Handle multer errors
      if (err) {
        console.error("Upload error:", err);
        return res.status(400).json({
          success: false,
          message: err.message || "File upload error"
        });
      }
      
      const { description } = req.body;
      const userId = req.user.id;
      
      // Validate that at least description or media is provided
      if ((!description || description.trim() === "") && !req.file) {
        return res.status(400).json({
          success: false,
          message: "Please add a description or media to your post"
        });
      }
      
      // Get user info
      const user = await db.collection("users").findOne(
        { _id: new ObjectId(userId) },
        { projection: { password: 0 } }
      );
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }
      
      // Prepare post data
      const postData = {
        userId: userId,
        userName: user.fullName,
        userEmail: user.email,
        userProfilePicture: user.profilePicture?.url || null,
        description: description?.trim() || "",
        media: req.file ? {
          url: req.file.path,
          publicId: req.file.filename,
          resourceType: req.file.mimetype?.startsWith('video') ? 'video' : 'image',
          mimeType: req.file.mimetype,
          size: req.file.size,
          uploadedAt: new Date()
        } : null,
        likes: [],
        likesCount: 0,
        comments: [],
        commentsCount: 0,
        shares: [],
        sharesCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
      };
      
      const result = await db.collection("posts").insertOne(postData);
      
      console.log("Post created successfully with ID:", result.insertedId);
      
      res.status(201).json({
        success: true,
        message: "Post created successfully",
        data: {
          _id: result.insertedId,
          ...postData
        }
      });
    } catch (error) {
      console.error("Create post error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to create post"
      });
    }
  });
});

// ==================== GET ALL POSTS ====================
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const posts = await db.collection("posts")
      .find({ isActive: true })
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .toArray();
    
    const total = await db.collection("posts").countDocuments({ isActive: true });
    
    res.status(200).json({
      success: true,
      message: "Posts fetched successfully",
      data: posts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error("Fetch posts error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch posts"
    });
  }
});

// ==================== GET SINGLE POST ====================
router.get("/:postId", async (req, res) => {
  try {
    const { postId } = req.params;
    
    if (!ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID format"
      });
    }
    
    const post = await db.collection("posts").findOne({ 
      _id: new ObjectId(postId),
      isActive: true 
    });
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }
    
    res.status(200).json({
      success: true,
      message: "Post fetched successfully",
      data: post
    });
  } catch (error) {
    console.error("Fetch single post error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch post"
    });
  }
});

// ==================== GET USER POSTS ====================
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    
    const posts = await db.collection("posts")
      .find({ userId: userId, isActive: true })
      .sort({ createdAt: -1 })
      .toArray();
    
    res.status(200).json({
      success: true,
      message: "User posts fetched successfully",
      data: posts
    });
  } catch (error) {
    console.error("Fetch user posts error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user posts"
    });
  }
});

// Update the like/unlike endpoint
router.post("/:postId/like", authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;
    
    if (!ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID format"
      });
    }
    
    const post = await db.collection("posts").findOne({ _id: new ObjectId(postId) });
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }
    
    const hasLiked = post.likes.includes(userId);
    
    if (hasLiked) {
      // Unlike
      await db.collection("posts").updateOne(
        { _id: new ObjectId(postId) },
        { 
          $pull: { likes: userId },
          $inc: { likesCount: -1 }
        }
      );
      
      res.status(200).json({
        success: true,
        message: "Post unliked successfully",
        data: { liked: false }
      });
    } else {
      // Like
      await db.collection("posts").updateOne(
        { _id: new ObjectId(postId) },
        { 
          $push: { likes: userId },
          $inc: { likesCount: 1 }
        }
      );
      
      // Create notification for post owner (if not liking own post)
      if (post.userId !== userId) {
        const user = await db.collection("users").findOne({ _id: new ObjectId(userId) });
        await createNotification(post.userId, 'post_like', {
          postId: postId,
          likerId: userId,
          likerName: user.fullName,
          likerProfilePicture: user.profilePicture?.url || null,
          message: `${user.fullName} liked your post`
        });
      }
      
      res.status(200).json({
        success: true,
        message: "Post liked successfully",
        data: { liked: true }
      });
    }
  } catch (error) {
    console.error("Like/Unlike error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process like"
    });
  }
});

// Update the add comment endpoint
router.post("/:postId/comment", authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const { text } = req.body;
    const userId = req.user.id;
    
    if (!text || text.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Comment text is required"
      });
    }
    
    if (!ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID format"
      });
    }
    
    // Get user info
    const user = await db.collection("users").findOne(
      { _id: new ObjectId(userId) },
      { projection: { password: 0 } }
    );
    
    const post = await db.collection("posts").findOne({ _id: new ObjectId(postId) });
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }
    
    const comment = {
      _id: new ObjectId(),
      userId: userId,
      userName: user.fullName,
      userProfilePicture: user.profilePicture?.url || null,
      text: text.trim(),
      createdAt: new Date(),
      likes: [],
      likesCount: 0
    };
    
    await db.collection("posts").updateOne(
      { _id: new ObjectId(postId) },
      { 
        $push: { comments: comment },
        $inc: { commentsCount: 1 }
      }
    );
    
    // Create notification for post owner (if not commenting on own post)
    if (post.userId !== userId) {
      await createNotification(post.userId, 'post_comment', {
        postId: postId,
        commentId: comment._id,
        commenterId: userId,
        commenterName: user.fullName,
        commenterProfilePicture: user.profilePicture?.url || null,
        commentText: text.trim(),
        message: `${user.fullName} commented on your post: "${text.trim().substring(0, 50)}${text.trim().length > 50 ? '...' : ''}"`
      });
    }
    
    res.status(200).json({
      success: true,
      message: "Comment added successfully",
      data: comment
    });
  } catch (error) {
    console.error("Add comment error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add comment"
    });
  }
});

// ==================== DELETE COMMENT ====================
router.delete("/:postId/comment/:commentId", authenticateToken, async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const userId = req.user.id;
    
    if (!ObjectId.isValid(postId) || !ObjectId.isValid(commentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID format"
      });
    }
    
    const post = await db.collection("posts").findOne({ _id: new ObjectId(postId) });
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }
    
    const comment = post.comments.find(c => c._id.toString() === commentId);
    
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found"
      });
    }
    
    // Check if user owns the comment or is admin
    if (comment.userId !== userId && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own comments"
      });
    }
    
    await db.collection("posts").updateOne(
      { _id: new ObjectId(postId) },
      { 
        $pull: { comments: { _id: new ObjectId(commentId) } },
        $inc: { commentsCount: -1 }
      }
    );
    
    res.status(200).json({
      success: true,
      message: "Comment deleted successfully"
    });
  } catch (error) {
    console.error("Delete comment error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete comment"
    });
  }
});

// ==================== SHARE POST ====================
router.post("/:postId/share", authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;
    
    if (!ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID format"
      });
    }
    
    const post = await db.collection("posts").findOne({ _id: new ObjectId(postId) });
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }
    
    const hasShared = post.shares.includes(userId);
    
    if (hasShared) {
      return res.status(400).json({
        success: false,
        message: "You have already shared this post"
      });
    }
    
    // Create a shared post reference
    const sharedPost = {
      originalPostId: postId,
      sharedByUserId: userId,
      sharedByUserName: (await db.collection("users").findOne({ _id: new ObjectId(userId) })).fullName,
      sharedAt: new Date(),
      originalPost: {
        userId: post.userId,
        userName: post.userName,
        userProfilePicture: post.userProfilePicture,
        description: post.description,
        media: post.media
      }
    };
    
    // Add to shares array in original post
    await db.collection("posts").updateOne(
      { _id: new ObjectId(postId) },
      { 
        $push: { shares: userId },
        $inc: { sharesCount: 1 }
      }
    );
    
    // Create a share post in the user's feed
    await db.collection("posts").insertOne({
      userId: userId,
      userName: (await db.collection("users").findOne({ _id: new ObjectId(userId) })).fullName,
      userEmail: (await db.collection("users").findOne({ _id: new ObjectId(userId) })).email,
      userProfilePicture: (await db.collection("users").findOne({ _id: new ObjectId(userId) })).profilePicture?.url || null,
      isShared: true,
      sharedData: sharedPost,
      likes: [],
      likesCount: 0,
      comments: [],
      commentsCount: 0,
      shares: [],
      sharesCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
    });
    
    res.status(200).json({
      success: true,
      message: "Post shared successfully"
    });
  } catch (error) {
    console.error("Share post error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to share post"
    });
  }
});

// ==================== UPDATE POST ====================
router.patch("/:postId", authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const { description } = req.body;
    const userId = req.user.id;
    
    if (!ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID format"
      });
    }
    
    const post = await db.collection("posts").findOne({ _id: new ObjectId(postId) });
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }
    
    // Check if user owns the post
    if (post.userId !== userId && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "You can only edit your own posts"
      });
    }
    
    const updateData = {
      description: description || post.description,
      updatedAt: new Date()
    };
    
    await db.collection("posts").updateOne(
      { _id: new ObjectId(postId) },
      { $set: updateData }
    );
    
    const updatedPost = await db.collection("posts").findOne({ _id: new ObjectId(postId) });
    
    res.status(200).json({
      success: true,
      message: "Post updated successfully",
      data: updatedPost
    });
  } catch (error) {
    console.error("Update post error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update post"
    });
  }
});

// ==================== DELETE POST ====================
router.delete("/:postId", authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;
    
    if (!ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID format"
      });
    }
    
    const post = await db.collection("posts").findOne({ _id: new ObjectId(postId) });
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }
    
    // Check if user owns the post or is admin
    if (post.userId !== userId && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own posts"
      });
    }
    
    // Soft delete - just mark as inactive
    await db.collection("posts").updateOne(
      { _id: new ObjectId(postId) },
      { 
        $set: { 
          isActive: false,
          deletedAt: new Date()
        }
      }
    );
    
    res.status(200).json({
      success: true,
      message: "Post deleted successfully"
    });
  } catch (error) {
    console.error("Delete post error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete post"
    });
  }
});




export default router;