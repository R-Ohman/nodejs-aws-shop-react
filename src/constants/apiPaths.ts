const CART_API = import.meta.env.VITE_CART_URL || "https://.execute-api.eu-west-1.amazonaws.com/dev";

const API_PATHS = {
  product: import.meta.env.VITE_PRODUCT_URL || "https://.execute-api.eu-west-1.amazonaws.com/dev",
  order: `${CART_API}/profile/cart`,
  import: import.meta.env.VITE_IMPORT_URL || "https://.execute-api.eu-west-1.amazonaws.com/dev",
  bff: "https://.execute-api.eu-west-1.amazonaws.com/dev",
  cart: CART_API,
};

export default API_PATHS;
