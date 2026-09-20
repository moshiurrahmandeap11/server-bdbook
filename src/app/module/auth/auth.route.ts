import { Router } from "express";
import { auth } from "../../middleware/auth";
import { validateRequest } from "../../middleware/validateRequest";
import { authController } from "./auth.controller";
import { authValidation } from "./auth.validation";

const router = Router();

router.post(
  "/signup",
  validateRequest(authValidation.signupValidationSchema),
  authController.signup
);

router.post(
  "/register",
  validateRequest(authValidation.signupValidationSchema),
  authController.signup
);

router.post(
  "/login",
  validateRequest(authValidation.loginValidationSchema),
  authController.login
);

router.post("/refresh-token", authController.refreshToken);

router.get("/me", auth(), authController.getMe);

router.post("/logout", authController.logout);

router.post("/google", authController.googleAuth);

export const authRoutes = router;
