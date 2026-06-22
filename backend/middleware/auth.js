export const requireAuth = (req, res, next) => {
  if (!req.session?.userId) return res.status(401).json({ error: 'Please sign in to continue.' });
  return next();
};
