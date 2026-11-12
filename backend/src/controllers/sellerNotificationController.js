const {
  getSellerNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead
} = require("../services/sellerNotificationService");

async function listNotifications(req, res, next) {
  try {
    const result = await getSellerNotifications(req.user.userId);
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function markAsRead(req, res, next) {
  try {
    const { id } = req.params;
    const result = await markNotificationAsRead(req.user.userId, id);
    return res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    next(error);
  }
}

async function markAllAsRead(req, res, next) {
  try {
    const result = await markAllNotificationsAsRead(req.user.userId);
    return res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listNotifications,
  markAsRead,
  markAllAsRead
};
