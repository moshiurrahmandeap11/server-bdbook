import { Router } from "express";
import { auth, optionalAuth } from "../../middleware/auth";
import { postUpload } from "../../middleware/upload";
import { validateRequest } from "../../middleware/validateRequest";
import { postController } from "./post.controller";
import { postValidation } from "./post.validation";

const router = Router();

router.post(
  "/create",
  auth(),
  postUpload.single("media"),
  postController.createPost
);

router.get("/", optionalAuth(), postController.getAllPosts);
router.get("/user/:userId", optionalAuth(), postController.getUserPosts);
router.get("/saved", auth(), postController.getSavedPosts);
router.get("/:postId", optionalAuth(), postController.getPostById);

router.get("/:postId/likes", auth(), postController.getPostLikes);
router.post("/:postId/like", auth(), postController.toggleLike);

router.post(
  "/:postId/comment",
  auth(),
  validateRequest(postValidation.commentValidationSchema),
  postController.addComment
);

router.patch(
  "/:postId/comment/:commentId",
  auth(),
  postController.editComment
);

router.delete(
  "/:postId/comment/:commentId",
  auth(),
  postController.deleteComment
);

router.post("/:postId/share", auth(), postController.sharePost);
router.post("/:postId/repost", auth(), postController.repost);
router.get("/:postId/reposts", auth(), postController.getReposts);

router.post("/:postId/save", auth(), postController.savePost);
router.post("/:postId/interested", auth(), postController.markInterested);
router.post("/:postId/not-interested", auth(), postController.markNotInterested);

router.patch(
  "/:postId",
  auth(),
  validateRequest(postValidation.editPostValidationSchema),
  postController.updatePost
);

router.delete("/:postId", auth(), postController.deletePost);

export const postRoutes = router;

