const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { check, validationResult } = require('express-validator');
const UserRepository = require('../repositories/userRepository');

class AuthController {
  async register(req, res, next) {
    try {
      await check('name', 'Name is required').notEmpty().run(req);
      await check('email', 'Please include a valid email').isEmail().run(req);
      await check('password', 'Password must be at least 6 characters').isLength({ min: 6 }).run(req);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, email, password } = req.body;
      const existingUser = await UserRepository.findUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await UserRepository.createUser({ name, email, password: hashedPassword });

      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
      res.status(201).json({ token, user: { id: user._id, name, email } });
    } catch (error) {
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      await check('email', 'Please include a valid email').isEmail().run(req);
      await check('password', 'Password is required').exists().run(req);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;
      const user = await UserRepository.findUserByEmail(email);
      if (!user) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }

      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
      res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();