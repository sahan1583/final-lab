// testing/static/chat/chat.js
document.addEventListener("DOMContentLoaded", function () {
    const chatBox = document.getElementById("chat-box");
    const sendButton = document.getElementById("send-btn");
    const titleInput = document.getElementById("title");
    const descriptionInput = document.getElementById("description");
    const locationInput = document.getElementById("location");
    const imageInput = document.getElementById("image");
    const loadMoreButton = document.getElementById("load-more-btn");

    let oldestMessageId = null;
    let isLoadingMore = false; 
    let hasMoreMessages = true; 

    // --- WebSocket Connection ---
    const socket = new WebSocket("ws://localhost:8001/ws/chat/"); 

    socket.onopen = function(e) {
        console.log("WebSocket connection established");
       
    };

    socket.onmessage = function (event) {
        const data = JSON.parse(event.data);
        console.log("Message received:", data); 

        switch (data.type) {
            case "chat_history":
                chatBox.innerHTML = ''; 
                if (data.messages && data.messages.length > 0) {
                    data.messages.forEach(msg => appendMessage(msg, false)); 
                    oldestMessageId = data.messages[0].id; 
                    loadMoreButton.style.display = 'block';
                    hasMoreMessages = true; 
                } else {
                    loadMoreButton.style.display = 'none';
                    hasMoreMessages = false;
                    loadMoreButton.disabled = true;
                    loadMoreButton.remove(); 
                }
                scrollToBottom(true); 
                break;

            case "older_chat_history": 
                isLoadingMore = false; 
                loadMoreButton.textContent = 'Load More'; 
                loadMoreButton.disabled = false;

                if (data.messages && data.messages.length > 0) {
                     const previousScrollHeight = chatBox.scrollHeight; 
                   
                    data.messages.reverse().forEach((msg) => {
                        appendMessage(msg, true); 
                    });
                    oldestMessageId = data.messages[data.messages.length - 1].id;

                    const newScrollHeight = chatBox.scrollHeight;
                    chatBox.scrollTop += (newScrollHeight - previousScrollHeight);

                     if (data.messages.length < 10) {
                        loadMoreButton.style.display = 'none';
                        hasMoreMessages = false;
                     } else {
                        loadMoreButton.style.display = 'block'; 
                        hasMoreMessages = true;
                     }

                } else {
                    loadMoreButton.style.display = 'none';
                    hasMoreMessages = false;
                }
                break;

            case "chat_message":
                appendMessage(data, false);
                scrollToBottom(true); 
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
            
             const maxSizeMB = 5;
             if (imageFile.size > maxSizeMB * 1024 * 1024) {
                 alert(`Image size exceeds ${maxSizeMB}MB limit.`);
                 imageInput.value = "";
                 return;
             }
        }

        let messageData = { type: "chat_message", title, description, location, image: null };

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
                } else {
                    console.error("Image upload failed:", result.error || 'Unknown error');
                    alert("Image upload failed. Sending message without image.");
                }
            } catch (error) {
                console.error("Image upload fetch error:", error);
                alert("Image upload failed. Sending message without image.");
            }
        }

        // Send the message via WebSocket
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(messageData));
            console.log("Message sent:", messageData);
            titleInput.value = "";
            descriptionInput.value = "";
            locationInput.value = "";
            imageInput.value = ""; 
        } else {
            console.error("WebSocket is not open. Message not sent.");
            alert("Connection lost. Cannot send message.");
        }
        sendButton.disabled = false;
        sendButton.textContent = 'Send';

    });


    function appendMessage(data, prepend = false) {
        if (!data || !data.title || !data.description || !data.location || !data.created_at) {
            console.warn("Received incomplete message data:", data);
            return; 
        }

        let imgHtml = '';
        if (data.image) {
             let correctedImageUrl = data.image.replace(/([^:]\/)\/+/g, "$1");
             let decodedImageUrl = decodeURIComponent(correctedImageUrl);
             const placeholder = "/static/default-placeholder.png"; 
             imgHtml = `<img src="${decodedImageUrl}" class="chat-img" loading="lazy" onerror="this.onerror=null; this.src='${placeholder}'; console.error('Failed to load image:', this.src);" />`;
        }


        const msgElement = document.createElement("div");
        msgElement.classList.add("message");
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

            if (!oldestMessageId || (data.id && data.id < oldestMessageId)) {
                oldestMessageId = data.id;
            }
        } else {
   
            const isNearBottom = chatBox.scrollHeight - chatBox.scrollTop - chatBox.clientHeight < 150;

            chatBox.appendChild(msgElement); 

            const img = msgElement.querySelector(".chat-img");
            if (img) {
                img.onload = () => {
                    scrollToBottom(true); 
                };
                if (img.complete) {
                    scrollToBottom(true); 
                }
            } else {
                scrollToBottom(true); 
            }
             
             // --- End scroll handling ---
        }
    }

     function escapeHTML(str) {
         const div = document.createElement('div');
         div.appendChild(document.createTextNode(str));
         return div.innerHTML;
     }


    // --- Scrolling ---
    function scrollToBottom(force = false) {
        if (force) {
            chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
            return; 
        }

        const isNearBottom = chatBox.scrollHeight - chatBox.scrollTop - chatBox.clientHeight < 150;
        if (isNearBottom) {
            chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
        }
    }

    // --- Load More Logic ---
    chatBox.addEventListener('scroll', function() {
        if (chatBox.scrollTop === 0 && !isLoadingMore && hasMoreMessages) {
            loadMoreButton.style.visibility = 'visible'; 
             loadMoreButton.style.opacity = '1';
        } else {
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