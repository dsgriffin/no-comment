const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
  mode: "production",
  entry: {
    service_worker: "./app/scripts/service_worker.ts",
    content: "./app/scripts/content.ts",
    options: "./app/scripts/options.ts",
    popup: "./app/scripts/popup.ts",
  },
  output: {
    clean: true,
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js"],
  },
  module: {
    rules: [
      { test: /\.tsx?$/, use: "ts-loader" },
      { test: /\.css$/, use: ["style-loader", "css-loader"] },
      { test: /\.(jpe?g|gif|png)$/, use: "file-loader?emitFile=false&name=[path][name].[ext]" },
    ],
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: "./app/images", to: path.resolve(__dirname, "dist") },
        { from: "./app/styles", to: path.resolve(__dirname, "dist") },
        { from: "./app/templates", to: path.resolve(__dirname, "dist") },
        { from: "./app/manifest.json", to: path.resolve(__dirname, "dist") },
      ],
    }),
  ],
};
