import { RouterProvider } from "react-router-dom";
import { browserRouter } from "./app/router";

export default function App() {
  return <RouterProvider router={browserRouter} />;
}
