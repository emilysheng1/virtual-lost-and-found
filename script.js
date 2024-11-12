const apiUrl = ''; 

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

    const attachModalEvents = (openButtonId, modalId) => {
        const openButton = document.getElementById(openButtonId);
        if (openButton) {
            openButton.addEventListener('click', () => showModal(modalId));
        }

        document.querySelectorAll(`#${modalId} .close-btn`).forEach(button => {
            button.addEventListener('click', () => hideModal(modalId));
        });
    };

    attachModalEvents('login-btn', 'login-form-modal');
    attachModalEvents('register-btn', 'register-form-modal');
    attachModalEvents('submit-item-btn', 'submit-form-modal');  // Attach events for the submit item modal

    document.getElementById('submit-item-btn').addEventListener('click', () => {
        if (isLoggedIn()) {
            showModal('submit-form-modal');
        } else {
            alert('Please log in or register an account to submit an item.');
        }
    });

    function isLoggedIn() {
        return localStorage.getItem('userToken') !== null;
    }

    function updateLoginState() {
        const userLoggedIn = isLoggedIn();
        document.getElementById('login-btn').style.display = userLoggedIn ? 'none' : 'inline-block';
        document.getElementById('register-btn').style.display = userLoggedIn ? 'none' : 'inline-block';
        document.getElementById('user-status').style.display = userLoggedIn ? 'block' : 'none';
    
        const userEmail = localStorage.getItem('userEmail');
        const deleteButtons = document.querySelectorAll('.delete-btn');
        deleteButtons.forEach(button => {
            const itemUploader = button.getAttribute('data-uploader');
            button.style.display = (userLoggedIn && itemUploader === userEmail) ? 'block' : 'none';
        });
    
        if (userLoggedIn) {
            document.getElementById('logged-in-user').textContent = userEmail;
            document.getElementById('dropdown-content').style.display = 'block';
        } else {
            document.getElementById('logged-in-user').textContent = '';
            document.getElementById('dropdown-content').style.display = 'none';
            hideModal('submit-form-modal');
        }
    }

    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.querySelector('#login-form input[type=email]').value;
        const password = document.querySelector('#login-form input[type=password]').value;

        fetch(`${apiUrl}/login`, {
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
                hideModal('login-form-modal');
            } else {
                alert('Login failed. Please check your credentials.');
            }
        })
        .catch((error) => {
            console.error('Error:', error);
        });
    });

    document.getElementById('register-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.querySelector('#register-form input[type=email]').value;
        const password = document.querySelector('#register-form input[type=password]').value;

        fetch(`${apiUrl}/register`, {
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
                hideModal('register-form-modal');
            } else {
                alert('Registration failed. Please try again.');
            }
        })
        .catch((error) => {
            console.error('Error:', error);
        });
    });

    document.getElementById('logout-link').addEventListener('click', (e) => {
        e.preventDefault();
        fetch(`${apiUrl}/logout`, {
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
            } else if (response.status === 403) {
                localStorage.removeItem('userEmail');
                localStorage.removeItem('userToken');
                updateLoginState();  
                console.error('Token expired or invalid');
            } else {
                console.error('Logout failed');
            }
        })
        .catch((error) => {
            console.error('Error:', error);
            localStorage.removeItem('userEmail');
            localStorage.removeItem('userToken');
            updateLoginState();
        });
    });
    
    document.getElementById('submit-item-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData();
        formData.append('itemName', document.getElementById('item-name').value);
        formData.append('itemDescription', document.getElementById('item-description').value);
        formData.append('itemStatus', document.getElementById('item-status').value);
        formData.append('itemImage', document.getElementById('item-image').files[0]);
        
        const itemLocation = document.getElementById('item-location').value;
        const itemLocationOther = document.getElementById('item-location-other').value;
        const location = itemLocation === 'other' ? itemLocationOther : itemLocation;
        formData.append('itemLocation', location);
        
        formData.append('userEmail', localStorage.getItem('userEmail'));

        fetch(`${apiUrl}/submit-item`, {
            method: 'POST',
            body: formData,
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('userToken'),
            },
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            addItemToHomePage(data.name, data.description, data.status, data.email, data.imageUrl, data.id, data.date, data.location);
        })
        .catch((error) => {
            console.error('Error:', error);
            alert('Failed to submit item. Please try again.');
        });
    });

    document.getElementById('items-display').addEventListener('click', function(e) {
        if (e.target && e.target.className.includes('delete-btn')) {
            const itemId = e.target.getAttribute('data-itemId');
            if (itemId) {
                deleteItem(itemId);
            } else {
                console.error('Item ID is undefined.');
            }
        }
    });

    function deleteItem(itemId) {
        fetch(`${apiUrl}/delete-item/${itemId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('userToken'),
            },
        })
        .then(response => {
            if (response.ok) {
                const itemsDisplay = document.getElementById('items-display');
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

    function formatDate(dateString) {
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return new Date(dateString).toLocaleDateString('en-US', options);
    }

    function addItemToHomePage(name, description, status, email, imageUrl, id, date, location) {
        const itemsDisplay = document.getElementById('items-list');
        const itemDiv = document.createElement('div');
        itemDiv.id = `item-${id}`;
        itemDiv.className = 'item';
        itemDiv.dataset.date = date; 
    
        const formattedDate = formatDate(date); 
    
        itemDiv.innerHTML = `
            <div class="item-content">
                <img src="${imageUrl}" alt="${name}" style="width: 100px; height: auto;">
                <h3>${name}</h3>
                <p class="item-description">${description}</p>
                <p class="item-status">Status: ${status}</p>
                <p class="item-location">Location: ${location}</p>
                <p class="item-date">Date: ${formattedDate}</p> <!-- Display the formatted date -->
                <p class="item-email">Submitted by: <a href="mailto:${email}">${email}</a></p>
            </div>
            <button data-itemId="${id}" data-uploader="${email}" class="delete-btn">Delete</button>`;
        
        itemsDisplay.appendChild(itemDiv);
        updateLoginState();
    }

    function fetchAndDisplayItems() {
        fetch(`${apiUrl}/items`, {
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('userToken'),
            },
        })
        .then(response => response.json())
        .then(data => {
            data.sort((a, b) => new Date(b.date) - new Date(a.date));
    
            data.forEach(item => addItemToHomePage(item.name, item.description, item.status, item.email, item.image, item.id, item.date, item.location));
        })
        .catch((error) => {
            console.error('Error fetching items:', error);
        });
    }

    fetchAndDisplayItems();
    updateLoginState();

    const searchInput = document.getElementById('search-keyword');
    const filterButtons = document.querySelectorAll('.filter-btn');

    function filterItems() {
        const keyword = searchInput.value.toLowerCase();
        const activeFilterBtn = document.querySelector('.filter-btn.active');
        const status = activeFilterBtn ? activeFilterBtn.getAttribute('data-status') : '';
    
        document.querySelectorAll('#items-list .item').forEach(item => {
            const nameElement = item.querySelector('h3');
            const descriptionElement = item.querySelector('.item-description');
            const locationElement = item.querySelector('.item-location');
            const itemStatusElement = item.querySelector('.item-status');
    
            if (!nameElement || !descriptionElement || !locationElement || !itemStatusElement) {
                return;
            }
    
            const name = nameElement.textContent.toLowerCase();
            const description = descriptionElement.textContent.toLowerCase();
            const location = locationElement.textContent.toLowerCase();
            const itemStatus = itemStatusElement.textContent.split(': ')[1].toLowerCase();
    
            const matchesKeyword = name.includes(keyword) || description.includes(keyword) || location.includes(keyword);
            const matchesStatus = !status || itemStatus === status;
    
            item.style.display = matchesKeyword && matchesStatus ? '' : 'none';
        });
    }

    searchInput.addEventListener('input', filterItems);

    filterButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            filterButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            filterItems();
        });
    });

    const sortDateSelect = document.getElementById('sort-date');

    sortDateSelect.addEventListener('change', () => {
        const selectedValue = sortDateSelect.value;
        sortItems(selectedValue);
    });

    function sortItems(order) {
        const itemsList = document.getElementById('items-list');
        const items = Array.from(itemsList.children);
        items.sort((a, b) => {
            const dateA = new Date(a.dataset.date);
            const dateB = new Date(b.dataset.date);

            return order === 'most-recent' ? dateB - dateA : dateA - dateB;
        });

        itemsList.innerHTML = '';
        items.forEach(item => itemsList.appendChild(item));
    }

    // Handle item location "other" field visibility
    const itemLocation = document.getElementById('item-location');
    const itemLocationOther = document.getElementById('item-location-other');

    itemLocation.addEventListener('change', () => {
        if (itemLocation.value === 'other') {
            itemLocationOther.classList.remove('hidden');
            itemLocationOther.required = true;
        } else {
            itemLocationOther.classList.add('hidden');
            itemLocationOther.required = false;
        }
    });
});
