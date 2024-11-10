import axios from "axios";
import { ProductTransaction } from '../models/ProductTransaction.js';

// Seed Database with Third-Party Data
export const seedDatabase = async (req, res) => {
  try {
    const response = await axios.get("https://s3.amazonaws.com/roxiler.com/product_transaction.json");

    if (!response.data || !Array.isArray(response.data)) {
      return res.status(400).json({ error: "Invalid data format from API" });
    }

    await ProductTransaction.deleteMany({}); // Clear existing data
    await ProductTransaction.insertMany(response.data); // Insert new data

    res.status(200).json({ message: "Database seeded successfully" });
  } catch (error) {
    console.error("Error seeding database:", error);
    res.status(500).json({ error: "Error seeding database" });
  }
};

// List All Transactions
export const listTransactions = async (req, res) => {
  try {
    const transactions = await ProductTransaction.find(); // No pagination applied

    const sanitizedTransactions = transactions.map(transaction => {
      if (isNaN(new Date(transaction.dateOfSale).getTime())) {
        transaction.dateOfSale = null; // Invalid date handling
      }
      return transaction;
    });

    res.status(200).json(sanitizedTransactions); // Return all transactions
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Error fetching transactions' });
  }
};

// Get Monthly Statistics
export const getStatistics = async (req, res) => {
  const { month, year } = req.query; // Get year from query parameter

  try {
    if (!month || !year) {
      return res.status(400).json({ error: "Month and Year are required" });
    }

    const { startDate, endDate } = getDateRange(getMonthNumber(month), parseInt(year));

    const soldItems = await ProductTransaction.find({
      dateOfSale: { $gte: startDate, $lt: endDate },
      sold: true,
    });
    const notSoldItems = await ProductTransaction.find({
      dateOfSale: { $gte: startDate, $lt: endDate },
      sold: false,
    });

    const totalSales = soldItems.reduce((sum, item) => sum + item.price, 0);

    res.json({
      totalSales,
      totalSoldItems: soldItems.length,
      totalNotSoldItems: notSoldItems.length,
    });
  } catch (error) {
    console.error("Error fetching statistics:", error);
    res.status(500).json({ error: "Error fetching statistics" });
  }
};

// Helper function to map month names to month numbers
const monthMap = {
  "Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6,
  "Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12
};

// Convert month name to month number
const getMonthNumber = (month) => {
  if (!month || typeof month !== 'string') throw new Error("Invalid month");
  const monthNumber = monthMap[month.trim()];
  if (!monthNumber) throw new Error("Invalid month");
  return monthNumber;
};

// Helper function to create date range for the selected month and year
const getDateRange = (monthNumber, year) => {
  // Ensure year is not null and is a number
  if (isNaN(year)) throw new Error("Invalid year");

  const startDate = new Date(Date.UTC(year, monthNumber - 1, 1)); // First day of the selected month
  const endDate = new Date(Date.UTC(year, monthNumber, 1)); // First day of the next month
  return { startDate, endDate };
};

// Helper function to map price range to an index in the result array
const priceRangeMapping = {
  "0-50": 0, "51-100": 1, "101-200": 2, "201-500": 3, "501-1000": 4, "1001+": 5
};

// Get price range data for a specific month
export const getPriceRangeData = async (selectedMonth, year) => {
  try {
    if (!selectedMonth || !year) {
      return { data: Array(6).fill(0) }; // Return empty data if no month or year
    }

    const { startDate, endDate } = getDateRange(getMonthNumber(selectedMonth), year);

    const productTransactions = await ProductTransaction.aggregate([
      { $match: { dateOfSale: { $gte: startDate, $lt: endDate } } },
      {
        $addFields: {
          priceRange: {
            $switch: {
              branches: [
                { case: { $lte: ["$price", 50] }, then: "0-50" },
                { case: { $lte: ["$price", 100] }, then: "51-100" },
                { case: { $lte: ["$price", 200] }, then: "101-200" },
                { case: { $lte: ["$price", 500] }, then: "201-500" },
                { case: { $lte: ["$price", 1000] }, then: "501-1000" },
                { case: { $gt: ["$price", 1000] }, then: "1001+" }
              ],
              default: "Unknown"
            }
          }
        }
      },
      { $group: { _id: "$priceRange", count: { $sum: 1 } } },
      { $sort: { "_id": 1 } },
      { $project: { priceRange: "$_id", count: 1, _id: 0 } }
    ]);

    const result = Array(6).fill(0);
    productTransactions.forEach(item => {
      const index = priceRangeMapping[item.priceRange];
      if (index !== undefined) result[index] = item.count;
    });

    return { data: result };
  } catch (error) {
    console.error("Error in getPriceRangeData:", error);
    return { data: Array(6).fill(0) };
  }
};

// Get category data for a specific month
export const getCategoryData = async (selectedMonth, year) => {
  try {
    if (!selectedMonth || !year) {
      return { data: [] }; // Return empty data if no month or year
    }

    const { startDate, endDate } = getDateRange(getMonthNumber(selectedMonth), year);

    const categoryTransactions = await ProductTransaction.aggregate([
      { $match: { dateOfSale: { $gte: startDate, $lt: endDate } } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $project: { category: "$_id", count: 1, _id: 0 } }
    ]);

    return { data: categoryTransactions };
  } catch (error) {
    console.error("Error in getCategoryData:", error);
    return { data: [] };
  }
};

// Get Combined Data from All Endpoints
export const getCombinedData = async (req, res) => {
  try {
    const selectedMonth = req.query.month;
    const year = parseInt(req.query.year); // Get year from query parameter

    if (!selectedMonth || !year) {
      return res.status(400).json({ error: "Month and Year are required" });
    }

    const [statistics, priceRangeData, categoryData] = await Promise.all([
      getStatistics(req, res),
      getPriceRangeData(selectedMonth, year),
      getCategoryData(selectedMonth, year),
    ]);

    res.json({
      statistics,
      priceRangeData,
      categoryData,
    });
  } catch (error) {
    console.error("Error fetching combined data:", error);
    res.status(500).json({ error: "Error fetching combined data" });
  }
};
