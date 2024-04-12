document.addEventListener('DOMContentLoaded', () => {
    const showModal = (modalId) => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
        }
    };

    const hideModal = (modalId) => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    };

    document.getElementById('loginBtn').addEventListener('click', () => showModal('loginFormModal'));
    document.getElementById('registerBtn').addEventListener('click', () => showModal('registerFormModal'));

    document.getElementById('submitItemBtn').addEventListener('click', () => {
        if (isLoggedIn()) {
            showModal('submitFormModal');
        } else {
            alert('Please log in or register an account to submit an item.');
        }
    });

    function isLoggedIn() {
        return localStorage.getItem('userToken') !== null;
    }

    function updateLoginState() {
        const userLoggedIn = isLoggedIn();
        document.getElementById('loginBtn').style.display = userLoggedIn ? 'none' : 'inline-block';
        document.getElementById('registerBtn').style.display = userLoggedIn ? 'none' : 'inline-block';
        document.getElementById('userStatus').style.display = userLoggedIn ? 'block' : 'none';
    
        const userEmail = localStorage.getItem('userEmail');
        const deleteButtons = document.querySelectorAll('.delete-btn');
        deleteButtons.forEach(button => {
            const itemUploader = button.getAttribute('data-uploader');
            button.style.display = (userLoggedIn && itemUploader === userEmail) ? 'block' : 'none';
        });
    
        if (userLoggedIn) {
            document.getElementById('loggedInUser').textContent = userEmail;
            document.getElementById('dropdownContent').style.display = 'block';
        } else {
            document.getElementById('loggedInUser').textContent = '';
            document.getElementById('dropdownContent').style.display = 'none';
            hideModal('submitFormModal');
        }
    }
    
    document.getElementById('registerForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.querySelector('#registerForm input[type=email]').value;
        const password = document.querySelector('#registerForm input[type=password]').value;

        fetch('http://localhost:3001/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.token) {
                localStorage.setItem('userEmail', email);
                localStorage.setItem('userToken', data.token);
                updateLoginState();
                hideModal('registerFormModal');
            } else {
                alert('Registration failed. Please try again.');
            }
        })
        .catch((error) => {
            console.error('Error:', error);
        });
    });

    document.getElementById('logoutLink').addEventListener('click', (e) => {
        e.preventDefault();
        fetch('http://localhost:3001/logout', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('userToken'),
                'Content-Type': 'application/json'
            },
        })
        .then(response => {
            if (response.ok) {
                localStorage.removeItem('userEmail');
                localStorage.removeItem('userToken');
                updateLoginState();
            } else {
                console.error('Logout failed');
            }
        })
        .catch((error) => {
            console.error('Error:', error);
        });
    });
    

    document.getElementById('submitItemForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData();
        formData.append('itemName', document.getElementById('itemName').value);
        formData.append('itemDescription', document.getElementById('itemDescription').value);
        formData.append('itemStatus', document.getElementById('itemStatus').value);
        formData.append('itemImage', document.getElementById('itemImage').files[0]);
        formData.append('userEmail', localStorage.getItem('userEmail'));


        fetch('http://localhost:3001/submit-item', {
            method: 'POST',
            body: formData,
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('userToken'),
            },
        })
        .then(response => response.json())
        .then(data => {
            addItemToHomePage(data.name, data.description, data.status, data.email, data.imageUrl, data.id);
        })
        .catch((error) => {
            console.error('Error:', error);
        });
    });

    document.getElementById('itemsDisplay').addEventListener('click', function(e) {
        if (e.target && e.target.className === 'delete-btn') {
            const itemId = e.target.getAttribute('data-itemId');
            deleteItem(itemId);
        }
    });

    function deleteItem(itemId) {
        fetch(`http://localhost:3001/delete-item/${itemId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('userToken'),
            },
        })
        .then(response => {
            if (response.ok) {
                const itemsDisplay = document.getElementById('itemsDisplay');
                const itemToDelete = document.getElementById(`item-${itemId}`);
                if (itemToDelete) {
                    itemsDisplay.removeChild(itemToDelete);
                }
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
    }

    function addItemToHomePage(name, description, status, email, imageUrl, id) {
        const itemsDisplay = document.getElementById('itemsDisplay');
        const itemDiv = document.createElement('div');
        itemDiv.id = `item-${id}`;
        itemDiv.className = 'item';
        itemDiv.innerHTML = `
            <h3>${name}</h3>
            <p>${description}</p>
            <p>Status: ${status}</p>
            <p>Submitted by: <a href="mailto:${email}">${email}</a></p>
            <img src="${imageUrl}" alt="Item Image" style="max-width: 100px; height: auto;">
            <button data-itemId="${id}" class="delete-btn">Delete</button>`;
        
        itemsDisplay.appendChild(itemDiv);
        updateLoginState();
    }

    function fetchAndDisplayItems() {
        fetch('http://localhost:3001/items', {
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('userToken'),
            },
        })
        .then(response => response.json())
        .then(data => {
            data.forEach(item => addItemToHomePage(item.name, item.description, item.status, item.email, item.imageUrl, item.id));
        })
        .catch((error) => {
            console.error('Error fetching items:', error);
        });
    }

    fetchAndDisplayItems();
    updateLoginState();
});
