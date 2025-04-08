const { dynamo } = require("../utils/aws-helper");
const { v4: uuidv4 } = require("uuid");
const tableName = "User";

const chatModel = {
  createchat: async (chatData) => {
    //const id = uuidv4();
    const params = {
      TableName: tableName,
      Item: {
        id: chatData.id
      },
    };
    try {
      await dynamo.put(params).promise();
      return { ...chatData };
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
  getchat: async () => {
    const params = {
      TableName: tableName,
    };
    try {
      const chat = await dynamo.scan(params).promise();
      return chat.Items;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
  deletechat: async (chatId) => {
    const id = chatId;
    const params = {
      TableName: tableName,
      Key: {
        id: Number(id),
      },
    };
    try {
      await dynamo.delete(params).promise();
      return { id: chatId };
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
  updatechat: async (chatId, updateData) => {
    const id = Number(chatId);
    const params = {
      TableName: tableName,
      Key: { id },
      UpdateExpression:
        "set #name = :name, #author = :author, #isbn = :isbn, #pages = :pages, #year = :year, #image = :image",
      ExpressionAttributeNames: {
        "#name": "name",
        "#author": "author",
        "#isbn": "isbn",
        "#pages": "pages",
        "#year": "year",
        "#image": "image",
      },
      ExpressionAttributeValues: {
        ":name": updateData.name,
        ":author": updateData.author,
        ":isbn": updateData.isbn,
        ":pages": Number(updateData.pages),
        ":year": Number(updateData.year),
        ":image": updateData.image,
      },
      ReturnValues: "ALL_NEW",
    };

    try {
      const result = await dynamo.update(params).promise();
      return result.Attributes;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
  getOnechat: async (chatId) => {
    const params = {
      TableName: tableName,
      Key: { id: Number(chatId) },
    };

    try {
      const result = await dynamo.get(params).promise();
      return result.Item || null;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
};

module.exports = chatModel;
