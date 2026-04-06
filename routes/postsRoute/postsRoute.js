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

// ==================== GET POST LIKES (for modal) ====================
router.get("/:postId/likes", authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;
    
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
    
    // Get user details for each like
    const likesWithUserInfo = await Promise.all(
      (post.likes || []).map(async (userId) => {
        const user = await db.collection("users").findOne(
          { _id: new ObjectId(userId) },
          { projection: { password: 0, email: 0 } }
        );
        return user ? {
          _id: user._id,
          name: user.fullName,
          userName: user.userName,
          profilePicture: user.profilePicture?.url || null
        } : null;
      })
    );
    
    res.json({
      success: true,
      data: likesWithUserInfo.filter(u => u !== null)
    });
  } catch (error) {
    console.error("Get likes error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch likes"
    });
  }
});

// ==================== SAVE POST ====================
router.post("/:postId/save", authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;
    
    if (!ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID format"
      });
    }
    
    const user = await db.collection("users").findOne({ _id: new ObjectId(userId) });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    const savedPosts = user.savedPosts || [];
    const isSaved = savedPosts.includes(postId);
    
    if (isSaved) {
      // Unsave
      await db.collection("users").updateOne(
        { _id: new ObjectId(userId) },
        { $pull: { savedPosts: postId } }
      );
    } else {
      // Save
      await db.collection("users").updateOne(
        { _id: new ObjectId(userId) },
        { $push: { savedPosts: postId } }
      );
    }
    
    res.json({
      success: true,
      message: isSaved ? "Post unsaved" : "Post saved",
      data: { isSaved: !isSaved }
    });
  } catch (error) {
    console.error("Save post error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save post"
    });
  }
});

// ==================== MARK INTERESTED ====================
router.post("/:postId/interested", authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;
    
    if (!ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID format"
      });
    }
    
    const user = await db.collection("users").findOne({ _id: new ObjectId(userId) });
    const interestedPosts = user.interestedPosts || [];
    const isInterested = interestedPosts.includes(postId);
    
    if (isInterested) {
      await db.collection("users").updateOne(
        { _id: new ObjectId(userId) },
        { $pull: { interestedPosts: postId } }
      );
    } else {
      await db.collection("users").updateOne(
        { _id: new ObjectId(userId) },
        { $push: { interestedPosts: postId } }
      );
    }
    
    res.json({
      success: true,
      message: isInterested ? "Removed from interested" : "Marked as interested",
      data: { isInterested: !isInterested }
    });
  } catch (error) {
    console.error("Mark interested error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark interest"
    });
  }
});

// ==================== NOT INTERESTED ====================
router.post("/:postId/not-interested", authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;
    
    if (!ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID format"
      });
    }
    
    const user = await db.collection("users").findOne({ _id: new ObjectId(userId) });
    const notInterestedPosts = user.notInterestedPosts || [];
    const isNotInterested = notInterestedPosts.includes(postId);
    
    if (isNotInterested) {
      await db.collection("users").updateOne(
        { _id: new ObjectId(userId) },
        { $pull: { notInterestedPosts: postId } }
      );
    } else {
      await db.collection("users").updateOne(
        { _id: new ObjectId(userId) },
        { $push: { notInterestedPosts: postId } }
      );
    }
    
    res.json({
      success: true,
      message: isNotInterested ? "Removed from not interested" : "Marked as not interested",
      data: { isNotInterested: !isNotInterested }
    });
  } catch (error) {
    console.error("Mark not interested error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark as not interested"
    });
  }
});

// ==================== REPOST (without sharing to feed) ====================
router.post("/:postId/repost", authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;
    
    if (!ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID format"
      });
    }
    
    const originalPost = await db.collection("posts").findOne({ 
      _id: new ObjectId(postId),
      isActive: true 
    });
    
    if (!originalPost) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }
    
    // Check if already reposted
    const existingRepost = await db.collection("posts").findOne({
      userId: userId,
      "originalPost._id": postId,
      isShare: true
    });
    
    if (existingRepost) {
      return res.status(400).json({
        success: false,
        message: "You have already reposted this"
      });
    }
    
    const currentUser = await db.collection("users").findOne(
      { _id: new ObjectId(userId) },
      { projection: { password: 0 } }
    );
    
    // Create repost (share post to profile)
    const repostDoc = {
      userId: userId,
      userName: currentUser.fullName,
      userEmail: currentUser.email,
      userProfilePicture: currentUser.profilePicture?.url || null,
      isShare: true,
      isRepost: true, // Mark as repost
      originalPost: {
        _id: originalPost._id.toString(),
        userId: originalPost.userId,
        userName: originalPost.userName,
        userProfilePicture: originalPost.userProfilePicture,
        description: originalPost.description,
        media: originalPost.media || null,
      },
      description: "",
      likes: [],
      likesCount: 0,
      comments: [],
      commentsCount: 0,
      shares: [],
      sharesCount: 0,
      reposts: [],
      repostsCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
    };
    
    const result = await db.collection("posts").insertOne(repostDoc);
    
    // Update original post repost count
    await db.collection("posts").updateOne(
      { _id: new ObjectId(postId) },
      {
        $push: { reposts: userId },
        $inc: { repostsCount: 1 }
      }
    );
    
    // Create notification
    if (originalPost.userId !== userId) {
      await createNotification(originalPost.userId, 'post_repost', {
        postId: postId,
        repostId: result.insertedId.toString(),
        reposterId: userId,
        reposterName: currentUser.fullName,
        reposterProfilePicture: currentUser.profilePicture?.url || null,
        message: `${currentUser.fullName} reposted your post`
      });
    }
    
    res.json({
      success: true,
      message: "Post reposted successfully",
      data: { repostId: result.insertedId.toString() }
    });
  } catch (error) {
    console.error("Repost error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to repost"
    });
  }
});

// ==================== GET REPOSTS ====================
router.get("/:postId/reposts", authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;
    
    if (!ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID format"
      });
    }
    
    const reposts = await db.collection("posts")
      .find({ 
        "originalPost._id": postId,
        isShare: true,
        isActive: true 
      })
      .sort({ createdAt: -1 })
      .toArray();
    
    const repostUsers = await Promise.all(
      reposts.map(async (repost) => {
        const user = await db.collection("users").findOne(
          { _id: new ObjectId(repost.userId) },
          { projection: { fullName: 1, profilePicture: 1 } }
        );
        return {
          userId: repost.userId,
          userName: user?.fullName || repost.userName,
          userProfilePicture: user?.profilePicture?.url || repost.userProfilePicture,
          repostedAt: repost.createdAt
        };
      })
    );
    
    res.json({
      success: true,
      data: repostUsers
    });
  } catch (error) {
    console.error("Get reposts error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch reposts"
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

// ==================== SHARE POST (FIXED) ====================
router.post("/:postId/share", authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    // ✅ FIX: Robust ObjectId validation
    let postObjectId;
    try {
      // Handle both string and ObjectId inputs
      const idString = typeof postId === 'string' ? postId.trim() : String(postId);
      
      if (!idString || idString.length !== 24) {
        throw new Error('Invalid length');
      }
      
      postObjectId = new ObjectId(idString);
    } catch (e) {
      console.error('Invalid postId format:', postId, e);
      return res.status(400).json({
        success: false,
        message: "Invalid post ID format"
      });
    }

    // Get original post
    const post = await db.collection("posts").findOne({ 
      _id: postObjectId,
      isActive: true 
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }

    // Prevent duplicate share
    const hasShared = post.shares?.includes(userId) || post.shares?.includes(String(userId));

    if (hasShared) {
      return res.status(400).json({
        success: false,
        message: "You have already shared this post"
      });
    }

    // Get current user
    const currentUser = await db.collection("users").findOne(
      { _id: new ObjectId(userId) },
      { projection: { password: 0 } }
    );

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // 1️⃣ Update original post (shares count)
    await db.collection("posts").updateOne(
      { _id: postObjectId },
      {
        $push: { shares: userId },
        $inc: { sharesCount: 1 }
      }
    );

    // 2️⃣ Create shared post
    const sharedPostDoc = {
      userId: userId,
      userName: currentUser.fullName,
      userEmail: currentUser.email,
      userProfilePicture: currentUser.profilePicture?.url || null,
      isShare: true,
      originalPost: {
        _id: post._id.toString(), // ✅ Ensure _id is string for frontend
        userId: post.userId,
        userName: post.userName,
        userProfilePicture: post.userProfilePicture,
        description: post.description,
        media: post.media || null,
      },
      description: "",
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

    const result = await db.collection("posts").insertOne(sharedPostDoc);

    // 3️⃣ Notification
    if (post.userId !== userId) {
      await createNotification(post.userId, "post_share", {
        postId: postId,
        sharedPostId: result.insertedId.toString(),
        sharerId: userId,
        sharerName: currentUser.fullName,
        sharerProfilePicture: currentUser.profilePicture?.url || null,
        message: `${currentUser.fullName} shared your post`
      });
    }

    res.status(200).json({
      success: true,
      message: "Post shared successfully",
      data: {
        _id: result.insertedId.toString(), // ✅ Return string ID
        ...sharedPostDoc
      }
    });

  } catch (error) {
    console.error("Share post error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to share post",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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

// Add this endpoint for replying to comments
router.post("/:postId/comment", authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const { text, parentCommentId } = req.body;
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
      likesCount: 0,
      replies: []
    };
    
    // If it's a reply to a comment
    if (parentCommentId) {
      await db.collection("posts").updateOne(
        { _id: new ObjectId(postId), "comments._id": new ObjectId(parentCommentId) },
        { 
          $push: { "comments.$.replies": comment }
        }
      );
    } else {
      // Regular comment
      await db.collection("posts").updateOne(
        { _id: new ObjectId(postId) },
        { 
          $push: { comments: comment },
          $inc: { commentsCount: 1 }
        }
      );
    }
    
    // Create notification for post owner
    if (post.userId !== userId) {
      await createNotification(post.userId, 'post_comment', {
        postId: postId,
        commentId: comment._id,
        commenterId: userId,
        commenterName: user.fullName,
        commenterProfilePicture: user.profilePicture?.url || null,
        commentText: text.trim(),
        message: `${user.fullName} commented on your post`
      });
    }
    
    res.status(200).json({
      success: true,
      message: parentCommentId ? "Reply added successfully" : "Comment added successfully",
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

// Edit comment endpoint
router.patch("/:postId/comment/:commentId", authenticateToken, async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const { text } = req.body;
    const userId = req.user.id;
    
    if (!text || text.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Comment text is required"
      });
    }
    
    const post = await db.collection("posts").findOne({ _id: new ObjectId(postId) });
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }
    
    // Find and update comment
    const updated = await db.collection("posts").updateOne(
      { 
        _id: new ObjectId(postId),
        "comments._id": new ObjectId(commentId),
        "comments.userId": userId
      },
      { 
        $set: { 
          "comments.$.text": text.trim(),
          "comments.$.updatedAt": new Date()
        }
      }
    );
    
    if (updated.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Comment not found or you don't have permission"
      });
    }
    
    res.status(200).json({
      success: true,
      message: "Comment updated successfully"
    });
  } catch (error) {
    console.error("Edit comment error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update comment"
    });
  }
});



export default router;