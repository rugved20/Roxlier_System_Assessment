import mongoose from "mongoose";

// Function to check if a date is valid
const isValidDate = (date) => {
  return !isNaN(Date.parse(date)); // Returns true if the date is valid
};

const productTransactionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
  dateOfSale: {
    type: Date,
    required: true,
    validate: {
      validator: function (value) {
        // Validate if the dateOfSale is a valid date
        return isValidDate(value);
      },
      message: "Invalid date format for dateOfSale",
    },
  },
  sold: {
    type: Boolean,
    required: true,
  },
  image: { type: String, required: true }, // Add the image field
});

// Create the model
const ProductTransaction = mongoose.model(
  "ProductTransaction",
  productTransactionSchema
);

// Method to delete many documents
export const deleteMany = () => {
  return ProductTransaction.deleteMany();
};

// Method to insert many documents
export const insertMany = async (data) => {
  // Validate dates in the incoming data
  for (const transaction of data) {
    if (!isValidDate(transaction.dateOfSale)) {
      throw new Error("Invalid date format in one or more transactions.");
    }
  }

  return ProductTransaction.insertMany(data);
};

// Method to find documents based on filter
export const find = (filter) => {
  return ProductTransaction.find(filter);
};

// Method to aggregate transactions with a pipeline
export const aggregate = (pipeline) => {
  return ProductTransaction.aggregate(pipeline);
};

// Export the model as named export
export { ProductTransaction };
