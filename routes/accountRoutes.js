        const express = require('express');
        const router = express.Router();
        const accountController = require('../controllers/accountController');
        const authenticateToken = require('../middleware/auth');

        router.post('/account.register', accountController.register);
        router.post('/account.login', accountController.login);
        router.get('/account.profile', authenticateToken, accountController.getProfile);

        // NEW endpoints for forgot/reset password:
        router.post('/account.forgotPassword', accountController.forgotPassword);
        router.post('/account.resetPassword', accountController.resetPassword);

        module.exports = router;
