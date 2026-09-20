const googleAuth = async (req: Request, res: Response): Promise<void> => {
  const { idToken, code, redirectUri } = req.body;
  if (!idToken && !code) {
    throw new AppError(status.BAD_REQUEST, "Either idToken or code is required");
  }
};

export const authController = {
  register,
  login,
  getMe,
  changePassword,
  logout,
  googleAuth,
};
