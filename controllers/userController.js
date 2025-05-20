const userModel = require('../models/userModel');
const { uploadFile } = require('../service');
const Controller = {};

Controller.getAccountByParam = async (req, res) => {
  switch(true) {
    case (req.query.phone) !== undefined:
      const { phone } = req.query
      try {
        const account = await userModel.getAccountByPhone(phone)
        res.status(200).json(account)
      } catch (error) {
        res.status(500).send("Error getting account")
      }
      break;
    case (req.query.id) !== undefined:
      const { id } = req.query
      try {
        const account = await userModel.getAccountById(id)
        res.status(200).json(account)
      } catch (error) {
        res.status(500).send("Error getting account")
      }
      break;
    case (req.query.email) !== undefined:
      const { email } = req.query
      try {
        const account = await userModel.getAccountByEmail(email)
        res.status(200).json(account)
      } catch (error) {
        res.status(500).send("Error getting account")
      }
      break;
    case (req.query.name) !== undefined:
      const { name } = req.query
      try {
        const accounts = await userModel.getAccountByName(name)
        res.status(200).json(accounts)
  } catch (error) {
        res.status(500).send("Error getting account")
  }
      break;
    default:
      res.status(400).send("Bad request")
}
};

Controller.updateAccount = async (req, res) => {
  let {id, name, password, phone, birthday, location, email, image} = req.body;
  if(id === -1) {
    id = Math.floor(Math.random() * 10000);
  }
  try {
    const newInfo = await userModel.updateAccount(id, {
        name,
        password,
        phone,
        birthday,
        location,
      email,
      image
    })
    res.status(200).json({ok: 1, ...newInfo})
  } catch (error) {
    console.log(error)
    res.status(400).json({ok: 0, message: "Error updating account"})
  }
}

Controller.uploadImage = async (req, res) => {
  const image = req.file
  try {
    const imageUrl = await uploadFile(image)
    res.status(200).json({ok: 1, imageUrl})
  } catch (error) {
    console.log(error)
    res.status(400).json({ok: 0, message: `Error uploading image: ${error.message}`})
  }
}

Controller.loginAccount = async (req, res) => {
  const { phone, password } = req.body;
  try {
    //check if phone number exists
    const accounts = await userModel.getAccountByPhone(phone)
    if (accounts.length > 0) {
      if (accounts[0].password === password) {
        res.status(200).json(accounts[0])
      } else {
        res.status(400).json({ok: 0, message: "Wrong password"})
      }
    } else {
      res.status(400).json({ok: 0, message: "Phone number not found"})
    }
  } catch (error) {
    res.status(500).send("Error logging in")
  }
}

Controller.registerAccount = async (req, res) => {
  const {name, password, phone, birthday, image, location, email } = req.body;
  try {
    //check if phone number exists
    const accounts = await userModel.getAccountByPhone(phone)
    if (accounts.length > 0) {
      return res.status(400).json({ok: 0, message: "Phone number already exists"})
    } else {
      const newAccount = await userModel.createAccount({
        //randomize a 4 digit userid
        id: Math.floor(Math.random() * 10000),
        name,
        password,
        phone,
        birthday,
        image,
        location,
        email
      })
      res.status(200).json(newAccount)
    }
  } catch (error) {
    res.status(500).send("Error creating account")
  }
}

Controller.getMainPath = async (req, res) => {
  res.status(200).send("Api is working")
}

Controller.changePassword = async (req, res) => {
  const { phone, oldpassword, newpassword } = req.body;
  try {
    //check if phone number exists
    const accounts = await userModel.getAccountByPhone(phone)
    if (accounts.length > 0) {
      if (accounts[0].password === oldpassword) {
        const newAccount = await userModel.changePassword(accounts[0].id, newpassword);
        res.status(200).json(newAccount)
      } else {
        res.status(400).json({ok: 0, message: "Current password is wrong"})
      }
    } else {
      res.status(400).json({ok: 0, message: "Phone number not found"})
    }
  } catch (error) {
    res.status(500).send("Error changing password")
  }
}

module.exports = Controller