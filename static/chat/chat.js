// testing/static/chat/chat.js
document.addEventListener("DOMContentLoaded", function () {
    const chatBox = document.getElementById("chat-box");
    const sendButton = document.getElementById("send-btn");
    const titleInput = document.getElementById("title");
    const descriptionInput = document.getElementById("description");
    const locationInput = document.getElementById("location");
    const imageInput = document.getElementById("image");
    const loadMoreButton = document.getElementById("load-more-btn"); // Get the button

    let oldestMessageId = null; // Store the ID of the oldest message visible
    let isLoadingMore = false; // Flag to prevent multiple simultaneous loads
    let hasMoreMessages = true; // Assume there are more messages initially

    // --- WebSocket Connection ---
    const socket = new WebSocket("ws://localhost:8001/ws/chat/"); // Keep your existing URL

    socket.onopen = function(e) {
        console.log("WebSocket connection established");
       
    };

    socket.onmessage = function (event) {
        const data = JSON.parse(event.data);
        console.log("Message received:", data); // Debugging

        switch (data.type) {
            case "chat_history": // Initial batch of messages
                chatBox.innerHTML = ''; // Clear previous messages if any
                if (data.messages && data.messages.length > 0) {
                    data.messages.forEach(msg => appendMessage(msg, false)); // Append initial messages
                    oldestMessageId = data.messages[0].id; // The first message in the initial batch is the oldest
                    // Show load more button only if initial batch potentially didn't fetch all
                    loadMoreButton.style.display = 'block';
                    hasMoreMessages = true; // Assume more unless proven otherwise
                } else {
                    // No initial messages, hide button
                    loadMoreButton.style.display = 'none';
                    hasMoreMessages = false;
                }
                scrollToBottom(); // Scroll down after loading initial history
                break;

            case "older_chat_history": // Batch of older messages
                isLoadingMore = false; // Loading finished
                loadMoreButton.textContent = 'Load More'; // Reset button text
                loadMoreButton.disabled = false;

                if (data.messages && data.messages.length > 0) {
                     const previousScrollHeight = chatBox.scrollHeight; // Height before adding messages
                    data.messages.forEach(msg => appendMessage(msg, true)); // Prepend older messages
                    oldestMessageId = data.messages[0].id; // Update oldest ID

                    // Try to maintain scroll position
                    const newScrollHeight = chatBox.scrollHeight;
                    chatBox.scrollTop += (newScrollHeight - previousScrollHeight);

                     // If fewer messages than requested were loaded, assume no more older ones exist
                     if (data.messages.length < 10) {
                        loadMoreButton.style.display = 'none'; // Hide button
                        hasMoreMessages = false;
                     } else {
                        loadMoreButton.style.display = 'block'; // Ensure button is visible if more might exist
                        hasMoreMessages = true;
                     }

                } else {
                    // No older messages received, hide the button permanently
                    loadMoreButton.style.display = 'none';
                    hasMoreMessages = false;
                }
                break;

            case "chat_message": // A single new message
                appendMessage(data, false); // Append new message
                scrollToBottom(); // Scroll down for new messages
                break;

            case "error": // Handle potential errors from backend
                console.error("Backend Error:", data.message);
                alert("Error: " + data.message); // Simple alert for user
                break;

            default:
                console.log("Unknown message type:", data.type);
        }
    };

    socket.onclose = function(e) {
        console.error('Chat socket closed unexpectedly', e);
        // Optionally try to reconnect or inform the user
        alert("Chat connection lost. Please refresh the page.");
    };

    socket.onerror = function(err) {
        console.error('WebSocket Error:', err);
         alert("Chat connection error. Please refresh the page.");
    };

    // --- Sending Messages ---
    sendButton.addEventListener("click", async function () {
        let title = titleInput.value.trim();
        let description = descriptionInput.value.trim();
        let location = locationInput.value.trim();
        let imageFile = imageInput.files[0];

        if (!title || !description || !location) {
            alert("Title, Description, and Location URL are required!");
            return;
        }
        // Basic URL validation (optional, can be improved)
        try {
             new URL(location);
        } catch (_) {
             alert("Please enter a valid Location URL (e.g., https://example.com).");
             return;
        }


        if (imageFile) {
            const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
            if (!allowedTypes.includes(imageFile.type)) {
                alert("Invalid file type! Please upload an image (JPG, PNG, GIF, WEBP).");
                imageInput.value = "";
                return;
            }
            // Optional: Check file size
             const maxSizeMB = 5;
             if (imageFile.size > maxSizeMB * 1024 * 1024) {
                 alert(`Image size exceeds ${maxSizeMB}MB limit.`);
                 imageInput.value = "";
                 return;
             }
        }

        // Prepare base message data (send type explicitly)
        let messageData = { type: "chat_message", title, description, location, image: null };

        // Disable send button while processing
        sendButton.disabled = true;
        sendButton.textContent = 'Sending...';


        if (imageFile) {
            let formData = new FormData();
            formData.append("image", imageFile);

            try {
                // Use the correct upload URL from your urls.py if it's different
                let response = await fetch("/upload-image/", { method: "POST", body: formData });
                let result = await response.json();

                if (response.ok && result.image_url) {
                    messageData.image = result.image_url; // Use the URL returned by the server
                    console.log("Image uploaded, URL:", messageData.image);
                } else {
                    console.error("Image upload failed:", result.error || 'Unknown error');
                    alert("Image upload failed. Sending message without image.");
                    // Decide if you want to send the message without the image or stop
                }
            } catch (error) {
                console.error("Image upload fetch error:", error);
                alert("Image upload failed. Sending message without image.");
                 // Decide if you want to send the message without the image or stop
            }
        }

        // Send the message via WebSocket
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(messageData));
            console.log("Message sent:", messageData);
             // Clear inputs only after successful sending confirmation (or immediately)
            titleInput.value = "";
            descriptionInput.value = "";
            locationInput.value = "";
            imageInput.value = ""; // Clear file input
        } else {
            console.error("WebSocket is not open. Message not sent.");
            alert("Connection lost. Cannot send message.");
        }
        // Re-enable send button
        sendButton.disabled = false;
        sendButton.textContent = 'Send';

    });

    // --- Appending/Prepending Messages ---
    function appendMessage(data, prepend = false) {
        if (!data || !data.title || !data.description || !data.location || !data.created_at) {
            console.warn("Received incomplete message data:", data);
            return; // Don't append incomplete messages
        }

        let imgHtml = '';
        if (data.image) {
             // Ensure URL is correctly formed (remove potential double slashes if needed)
             let correctedImageUrl = data.image.replace(/([^:]\/)\/+/g, "$1");
             // Decode URI Component in case URL got encoded somewhere
             let decodedImageUrl = decodeURIComponent(correctedImageUrl);
             // Use a placeholder if the image fails to load
             const placeholder = "/static/default-placeholder.png"; // Define your placeholder path
             imgHtml = `<img src="${decodedImageUrl}" class="chat-img" loading="lazy" onerror="this.onerror=null; this.src='${placeholder}'; console.error('Failed to load image:', this.src);" />`;
        }


        const msgElement = document.createElement("div");
        msgElement.classList.add("message");
        // Add a data attribute to easily find the oldest message's ID later if needed
        msgElement.dataset.messageId = data.id;
        msgElement.innerHTML = `
            <strong>${escapeHTML(data.title)}</strong><br>
            ${escapeHTML(data.description)}<br>
            <a href="${escapeHTML(data.location)}" target="_blank" rel="noopener noreferrer">${escapeHTML(data.location)}</a><br>
            ${imgHtml}
            <small>${escapeHTML(data.created_at)}</small>
        `;

        if (prepend) {
            chatBox.insertBefore(msgElement, chatBox.firstChild); // Insert at the top
        } else {
            chatBox.appendChild(msgElement); // Insert at the bottom
        }
    }

     // Helper function to escape HTML to prevent XSS
     function escapeHTML(str) {
         const div = document.createElement('div');
         div.appendChild(document.createTextNode(str));
         return div.innerHTML;
     }


    // --- Scrolling ---
    function scrollToBottom() {
        // Only scroll down if the user isn't scrolled up significantly
        // Adjust the threshold (e.g., 100 pixels) as needed
        if (chatBox.scrollHeight - chatBox.scrollTop - chatBox.clientHeight < 100) {
             chatBox.scrollTop = chatBox.scrollHeight;
        }
    }

    // --- Load More Logic ---
    chatBox.addEventListener('scroll', function() {
        // Show button if scrolled to top and not already loading and more messages might exist
        if (chatBox.scrollTop === 0 && !isLoadingMore && hasMoreMessages) {
            loadMoreButton.style.visibility = 'visible'; // Make it visible
             loadMoreButton.style.opacity = '1';
        } else {
            // Hide button smoothly if not at top
            loadMoreButton.style.visibility = 'hidden';
            loadMoreButton.style.opacity = '0';
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