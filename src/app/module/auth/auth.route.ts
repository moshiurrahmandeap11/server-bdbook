import { Router } from "express";
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
  "/login",
  validateRequest(authValidation.loginValidationSchema),
  authController.login
);

router.post("/logout", authController.logout);

export const authRoutes = router;

