// In product_details.js
const params = new URLSearchParams(window.location.search);
const product_id = params.get("product_id");

fetch("/api/products")
    .then(res => res.json())
    .then(data => {
        // Filter down to just the one you want
        const product = data.products.find(p => p.product_id == product_id);
        // populate your HTML with product.name, product.price etc.
    });