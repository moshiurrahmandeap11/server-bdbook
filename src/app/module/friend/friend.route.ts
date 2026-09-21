import { Router } from "express";
import { auth } from "../../middleware/auth";
import { friendController } from "./friend.controller";

const router = Router();

router.post("/friend-request/:userId", auth(), friendController.sendFriendRequest);
router.post(
  "/friend-request/accept/:requestId",
  auth(),
  friendController.acceptFriendRequest
);
router.post(
  "/friend-request/decline/:requestId",
  auth(),
  friendController.declineFriendRequest
);

router.get("/friend-requests", auth(), friendController.getFriendRequests);
router.get("/friends", auth(), friendController.getFriends);
router.get("/friends/:userId", auth(), friendController.getUserFriends);
router.get("/friends/count/:userId", friendController.getFriendsCount);

router.get("/followers/:userId", friendController.getFollowers);
router.get("/followers/count/:userId", friendController.getFollowersCount);

router.get("/following/:userId", friendController.getFollowing);
router.get("/following/count/:userId", friendController.getFollowingCount);

router.get("/friend-status/:userId", auth(), friendController.getFriendStatus);
router.delete("/friends/:friendId", auth(), friendController.removeFriend);

router.get("/saved-posts/:userId", auth(), friendController.getSavedPosts);

export const friendRoutes = router;

