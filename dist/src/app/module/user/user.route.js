import { Router } from "express";
import { auth } from "../../middleware/auth.js";
import { coverPhotoUpload, profilePictureUpload, } from "../../middleware/upload.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { authController } from "../auth/auth.controller.js";
import { authValidation } from "../auth/auth.validation.js";
import { friendRoutes } from "../friend/friend.route.js";
import { messageRoutes } from "../message/message.route.js";
import { userController } from "./user.controller.js";
import { userValidation } from "./user.validation.js";
const router = Router();
// Auth compatibility routes (used by client-bdbook AuthProvider)
router.post("/signup", validateRequest(authValidation.signupValidationSchema), authController.signup);
router.post("/login", validateRequest(authValidation.loginValidationSchema), authController.login);
router.post("/logout", authController.logout);
// User profile routes
router.get("/me", auth(), userController.getMe);
router.get("/", userController.getAllUsers);
router.get("/id/:id", userController.getUserById);
router.get("/email/:email", userController.getUserByEmail);
router.get("/search/:query", userController.searchUsers);
router.patch("/:id", auth(), validateRequest(userValidation.updateUserValidationSchema), userController.updateUser);
router.delete("/:id", auth(), userController.deleteUser);
// Profile and cover picture upload/delete
router.post("/upload-profile-pic", auth(), profilePictureUpload.single("profilePic"), userController.uploadProfilePicture);
router.delete("/remove-profile-pic", auth(), userController.removeProfilePicture);
router.post("/upload-cover-photo", auth(), coverPhotoUpload.single("coverPhoto"), userController.uploadCoverPhoto);
router.delete("/remove-cover-photo", auth(), userController.removeCoverPhoto);
router.post("/change-password", auth(), validateRequest(userValidation.changePasswordValidationSchema), userController.changePassword);
// Mount friend and message sub-routes onto /users for 100% frontend backwards compatibility
router.use("/", friendRoutes);
router.use("/", messageRoutes);
export const userRoutes = router;
