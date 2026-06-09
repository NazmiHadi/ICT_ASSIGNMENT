// Cart system using localStorage
function addToCart(product){
 let role=localStorage.getItem('role');
 if(!role){ alert('Please login first'); location.href='login.html'; return; }
 let cart=JSON.parse(localStorage.getItem('cart')||'[]');
 cart.push(product);
 localStorage.setItem('cart',JSON.stringify(cart));
}
