import { Router } from "express";
import { auth } from "../../middleware/auth";
import { followController } from "./follow.controller";

const router = Router();

router.post("/follow/:userId", auth(), followController.followUser);
router.post("/unfollow/:userId", auth(), followController.unfollowUser);
router.get("/status/:userId", auth(), followController.getFollowStatus);

router.get("/followers/:userId", followController.getFollowers);
router.get("/followers/count/:userId", followController.getFollowersCount);

router.get("/following/:userId", followController.getFollowing);
router.get("/following/count/:userId", followController.getFollowingCount);

export const followRoutes = router;

