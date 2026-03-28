var express = require("express");
var router = express.Router();
let userModel = require("../schemas/users");
let roleModel = require("../schemas/roles");
let { CreateAnUserValidator, validatedResult, ModifyAnUser } = require('../utils/validateHandler')
let userController = require('../controllers/users')
let { CheckLogin,CheckRole } = require('../utils/authHandler')
let fs = require('fs');
let csv = require('csv-parser');
let crypto = require('crypto');
let { sendPasswordEmail } = require('../utils/mailHandler');

router.delete("/deleteImported", async function (req, res, next) {
  try {
    const result = await userModel.deleteMany({ username: /^user\d+$/ });
    res.send({ message: 'Đã xóa', deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

router.post("/import", async function (req, res, next) {
  try {
    let userRole = await roleModel.findOne({ name: 'user' });
    if (!userRole) userRole = await roleModel.create({ name: 'user', description: 'Người dùng thông thường' });

    const users = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream(__dirname + '/../utils/users.csv')
        .pipe(csv())
        .on('data', (row) => users.push(row))
        .on('end', resolve)
        .on('error', reject);
    });

    const results = [];
    for (const { username, email } of users) {
      try {
        const exists = await userModel.findOne({ $or: [{ username }, { email }] });
        if (exists) {
          results.push({ username, email, status: 'skipped' });
          continue;
        }
        const password = crypto.randomBytes(12).toString('base64').slice(0, 16);
        const user = new userModel({ username, email, password, role: userRole._id });
        await user.save();
        try {
          await sendPasswordEmail(email, username, password);
          results.push({ username, email, password, status: 'created' });
        } catch (mailErr) {
          results.push({ username, email, password, status: 'created_no_email', error: mailErr.message });
        }
        await new Promise(r => setTimeout(r, 1000));
      } catch (e) {
        results.push({ username, email, status: 'error', error: e.message });
      }
    }

    res.send({ message: 'Import hoàn tất', total: results.length, results });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

router.get("/", CheckLogin,CheckRole("ADMIN"), async function (req, res, next) {
  let users = await userController.GetAllUser()
  res.send(users);
});

router.get("/:id", CheckLogin,CheckRole("ADMIN","MODERATOR"), async function (req, res, next) {
  try {
    let result = await userModel
      .find({ _id: req.params.id, isDeleted: false })
    if (result.length > 0) {
      res.send(result);
    }
    else {
      res.status(404).send({ message: "id not found" });
    }
  } catch (error) {
    res.status(404).send({ message: "id not found" });
  }
});

router.post("/", CreateAnUserValidator, validatedResult, async function (req, res, next) {
  try {
    let newItem = await userController.CreateAnUser(
      req.body.username, req.body.password, req.body.email, req.body.role,
      req.body.fullName, req.body.avatarUrl, req.body.status, req.body.loginCount
    )
    // populate cho đẹp
    let saved = await userModel
      .findById(newItem._id)
    res.send(saved);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.put("/:id", ModifyAnUser, validatedResult, async function (req, res, next) {
  try {
    let id = req.params.id;
    let updatedItem = await userModel.findByIdAndUpdate(id, req.body, { new: true });

    if (!updatedItem) return res.status(404).send({ message: "id not found" });

    let populated = await userModel
      .findById(updatedItem._id)
    res.send(populated);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.delete("/:id", async function (req, res, next) {
  try {
    let id = req.params.id;
    let updatedItem = await userModel.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true }
    );
    if (!updatedItem) {
      return res.status(404).send({ message: "id not found" });
    }
    res.send(updatedItem);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

module.exports = router;