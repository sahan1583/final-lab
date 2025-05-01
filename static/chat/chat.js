document.addEventListener("DOMContentLoaded", function () {
    const chatBox = document.getElementById("chat-box");
    const sendButton = document.getElementById("send-btn");
    const descriptionInput = document.getElementById("description"); 
    const locationInput = document.getElementById("location");
    const imageInput = document.getElementById("image");
    const loadMoreButton = document.getElementById("load-more-btn");

    // --- Add username retrieval ---
    let currentUserName = 'Anonymous'; // Default
    if (chatBox && chatBox.dataset.username) {
        currentUserName = chatBox.dataset.username;
    }
    console.log("Chat JS (Original Base) - User Name:", currentUserName);
    // ----------------------------

    let oldestMessageId = null;
    let isLoadingMore = false;
    let hasMoreMessages = true;

    // --- WebSocket Connection --
    const wsScheme = window.location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(`ws://localhost:8001/ws/chat/`);
    
    socket.onopen = function(e) {
        console.log("WebSocket connection established");
    };

    socket.onmessage = function (event) {
        const data = JSON.parse(event.data);
        console.log("Message received:", data);

        switch (data.type) {
            case "chat_history":
                chatBox.innerHTML = ''; // Clear existing
                if (data.messages && data.messages.length > 0) {
                    data.messages.forEach(msg => appendMessage(msg, false)); // Append oldest first
                    oldestMessageId = data.messages[0]?.id; // Use optional chaining
                    loadMoreButton.style.display = 'block'; // Show button initially if history exists
                    hasMoreMessages = data.messages.length >= 10; // Assume page size 10
                    loadMoreButton.style.visibility = hasMoreMessages ? 'hidden' : 'hidden'; // Hide button until scroll
                    loadMoreButton.style.opacity = hasMoreMessages ? '0' : '0';
                    loadMoreButton.style.display = hasMoreMessages ? 'block' : 'none'; // Hide if fewer than 10 msgs
                } else {
                    loadMoreButton.style.display = 'none';
                    hasMoreMessages = false;
                }
                scrollToBottom(true); // Scroll down after initial load
                break;

            case "older_chat_history": // Keep original logic, but note potential ordering issues
                isLoadingMore = false;
                loadMoreButton.textContent = 'Load More';
                loadMoreButton.disabled = false;

                if (data.messages && data.messages.length > 0) {
                    const previousScrollHeight = chatBox.scrollHeight;
                    
                    data.messages.reverse().forEach((msg) => {
                        appendMessage(msg, true); // Prepend = true
                    });
                   
                    oldestMessageId = data.messages[data.messages.length - 1]?.id;

                    const newScrollHeight = chatBox.scrollHeight;
                    chatBox.scrollTop += (newScrollHeight - previousScrollHeight); 
                    hasMoreMessages = data.messages.length >= 10; 
                    loadMoreButton.style.display = hasMoreMessages ? 'block' : 'none';
                    loadMoreButton.style.visibility = hasMoreMessages ? 'hidden' : 'hidden'; 
                    loadMoreButton.style.opacity = hasMoreMessages ? '0' : '0';

                } else {
                    loadMoreButton.style.display = 'none'; 
                    hasMoreMessages = false;
                }
                break;

            case "chat_message":
                appendMessage(data, false);
                break;

            case "error":
                console.error("Backend Error:", data.message);
                alert("Error: " + data.message);
                break;

            default:
                console.log("Unknown message type:", data.type);
        }
    };

    socket.onclose = function(e) {
        console.error('Chat socket closed unexpectedly', e);
    };

    socket.onerror = function(err) {
        console.error('WebSocket Error:', err);
    };

    // --- Sending Messages ---
    sendButton.addEventListener("click", async function () {
        let description = descriptionInput.value.trim(); 
        let location = locationInput.value.trim();
        let imageFile = imageInput.files[0];

        if (!description ) {
            alert("'Case Info'is required!");
            return;
        }
        
        // --- Include username ---
        let messageData = {
            type: "chat_message",
            username: currentUserName, 
            
            description: description,
            location: location,
            image: null // Placeholder
        };
        // ----------------------

        sendButton.disabled = true;
        sendButton.textContent = 'Sending...';

      
        if (imageFile) {
            let formData = new FormData();
            formData.append("image", imageFile);
            try {
                let response = await fetch("/upload-image/", { method: "POST", body: formData });
                let result = await response.json();
                if (response.ok && result.image_url) {
                    messageData.image = result.image_url;
                    console.log("Image uploaded, URL:", messageData.image);
                } else { /* Handle error */ }
            } catch (error) { /* Handle fetch error */ }
        }

        // Send the message via WebSocket
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(messageData));
            console.log("Message sent:", messageData);
            descriptionInput.value = "";
            locationInput.value = "";
            imageInput.value = "";
        } else { /* Handle closed socket */ }

        sendButton.disabled = false;
        sendButton.textContent = 'Send';
    });


    // --- Appending Messages ---
    function appendMessage(data, prepend = false) {
        // Basic validation - ensure username exists now too
        if (!data || !data.username || !data.description ) {
            console.warn("Received incomplete message data:", data);
            return;
        }

        let imgHtml = '';
        if (data.image) {
             let correctedImageUrl = data.image.replace(/([^:]\/)\/+/g, "$1");
             let decodedImageUrl = decodeURIComponent(correctedImageUrl);
             const placeholder = "/static/default-placeholder.png"; // Adjust if needed
             imgHtml = `<img src="${decodedImageUrl}" class="chat-img" loading="lazy" onerror="this.onerror=null; this.src='${placeholder}'; console.error('Failed to load image:', this.src);" alt="Chat content image"/>`;
        }

        const msgElement = document.createElement("div");
        msgElement.classList.add("message");
        msgElement.dataset.messageId = data.id; // Use message ID

        // --- Display username and structure ---
        msgElement.innerHTML = `
            <div class="message-username"><strong>${escapeHTML(data.username)}</strong></div>
            <div class="message-content">
                ${escapeHTML(data.description)}<br>
                <a href="${escapeHTML(data.location)}" target="_blank" rel="noopener noreferrer">${escapeHTML(data.location)}</a><br>
                ${imgHtml}
            </div>
            <div class="message-timestamp"><small>${escapeHTML(data.created_at)}</small></div>
        `;
        // ------------------------------------

        if (prepend) {
            chatBox.insertBefore(msgElement, chatBox.firstChild); // Insert at the top
            
            if (!oldestMessageId || (data.id && data.id < oldestMessageId)) {
                oldestMessageId = data.id;
            }
        } else {
            chatBox.appendChild(msgElement);
    
            const img = msgElement.querySelector(".chat-img");
            if (img) {
                if (img.complete || img.naturalHeight === 0) {
                    scrollToBottom(true); 
                } else {
                    img.onload = () => {
                        scrollToBottom(true); 
                    };
                    img.onerror = () => { 
                        scrollToBottom(true); 
                    };
                }
            } else {
                scrollToBottom(true); 
            }
            // --- End of logic for appending NEW messages ---
        }
    }

    // --- Utility: Escape HTML ---
    function escapeHTML(str) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(str || ''));
        return div.innerHTML;
    }

    // --- Scrolling ---
    function scrollToBottom(force = false) {
         chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
    }

    // --- Load More Logic (Keep Original) ---
    chatBox.addEventListener('scroll', function() {
        if (chatBox.scrollTop === 0 && !isLoadingMore && hasMoreMessages) {
            loadMoreButton.style.visibility = 'visible';
            loadMoreButton.style.opacity = '1';
        } else {
            // Hide smoothly if not at the top
            loadMoreButton.style.opacity = '0';
            setTimeout(() => {
                if (loadMoreButton.style.opacity === '0') {
                    loadMoreButton.style.visibility = 'hidden';
                }
            }, 300); // Match CSS transition
        }
    });

    loadMoreButton.addEventListener('click', function() {
        if (!isLoadingMore && oldestMessageId && hasMoreMessages) {
            isLoadingMore = true;
            loadMoreButton.textContent = 'Loading...';
            loadMoreButton.disabled = true;
            console.log("Requesting older messages than ID:", oldestMessageId);
            socket.send(JSON.stringify({
                type: "load_older_messages",
                oldest_id: oldestMessageId
            }));
        }
    });

}); 
