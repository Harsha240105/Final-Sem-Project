import axios from "axios";

const DEFAULT_API_HOST = "http://localhost:5001";
const API_PREFIX = "/api";

function normalizeApiBaseUrl(rawBaseUrl) {
  const fallback = `${DEFAULT_API_HOST}${API_PREFIX}`;

  if (!rawBaseUrl || typeof rawBaseUrl !== "string") {
    return fallback;
  }

  const trimmed = rawBaseUrl.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(trimmed)) {
    return fallback;
  }

  return trimmed.endsWith(API_PREFIX) ? trimmed : `${trimmed}${API_PREFIX}`;
}

export const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
export const API_SERVER_ORIGIN = API_BASE_URL.replace(/\/api$/, "");
const DEFAULT_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS) || 15000;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: DEFAULT_TIMEOUT_MS,
  headers: {
    Accept: "application/json",
  },
});

function attachTokenIfAvailable(headers = {}, token) {
  if (token) {
    return { ...headers, Authorization: `Bearer ${token}` };
  }

  if (typeof window !== "undefined") {
    const storedToken = window.localStorage.getItem("token");
    if (storedToken) {
      return { ...headers, Authorization: `Bearer ${storedToken}` };
    }
  }

  return headers;
}

function withAuth(token, config = {}) {
  return {
    ...config,
    headers: attachTokenIfAvailable(config.headers || {}, token),
  };
}

function normalizeApiError(error) {
  if (error.code === "ECONNABORTED" || /timeout/i.test(error.message || "")) {
    error.message = `Server request timed out. Check backend logs and confirm API URL is ${API_SERVER_ORIGIN}.`;
    return error;
  }

  if (error.response?.status === 404) {
    error.message = error.response?.data?.error || "API route not found. Verify frontend path matches backend route.";
    return error;
  }

  if (error.response?.status === 503) {
    error.message = error.response?.data?.error || "Service temporarily unavailable. Please try again shortly.";
    return error;
  }

  if (error.request && !error.response) {
    error.message = `Cannot reach backend API. Confirm backend is running on ${API_SERVER_ORIGIN}.`;
    return error;
  }

  return error;
}

apiClient.interceptors.request.use(
  (config) => {
    config.headers = attachTokenIfAvailable(config.headers || {}, null);
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const normalizedError = normalizeApiError(error);

    if (normalizedError.response) {
      console.error("API Error:", normalizedError.response.status, normalizedError.response.data);
    } else if (normalizedError.request) {
      console.error("Network Error: No response from server", normalizedError.request);
    } else {
      console.error("Request Error:", normalizedError.message);
    }

    return Promise.reject(normalizedError);
  }
);

async function request(promise) {
  try {
    const response = await promise;
    return response.data;
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function discoverUsers(token, search = "") {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  return request(apiClient.get(`/connections/users/discover${query}`, withAuth(token)));
}

export async function createAdminAccount(name, email, password, adminSecret) {
  return request(apiClient.post("/admin/create", { name, email, password, adminSecret }));
}

export async function getPendingTeachers(token) {
  return request(apiClient.get("/admin/pending-teachers", withAuth(token)));
}

export async function approveTeacher(teacherId, token) {
  return request(apiClient.post(`/admin/approve-teacher/${teacherId}`, {}, withAuth(token)));
}

export async function rejectTeacher(teacherId, token) {
  return request(apiClient.post(`/admin/reject-teacher/${teacherId}`, {}, withAuth(token)));
}

export async function createAccountByAdmin(data, token) {
  return request(apiClient.post("/admin/create-account", data, withAuth(token)));
}

export async function setupOrganisation(data, token) {
  return request(apiClient.post("/admin/organisation-setup", data, withAuth(token)));
}

export async function getOrganisationStatus(token) {
  return request(apiClient.get("/admin/organisation-status", withAuth(token)));
}

export async function createTask(data, token) {
  // Handle FormData for file uploads or regular JSON
  const config = withAuth(token);
  if (data instanceof FormData) {
    // Let axios handle FormData and set Content-Type to multipart/form-data
    config.headers = config.headers || {};
    delete config.headers["Content-Type"]; // Let axios set it
  }
  return request(apiClient.post("/tasks", data, config));
}

export async function getTasksByCommunity(communityId, token) {
  return request(apiClient.get(`/tasks/community/${communityId}`, withAuth(token)));
}

export async function completeTask(taskId, token) {
  return request(
    apiClient.patch(`/tasks/${taskId}/complete`, {}, withAuth(token, { timeout: 30000 }))
  );
}

export async function markTaskCompletedByStudent(taskId, token) {
  return request(
    apiClient.patch(`/tasks/${taskId}/mark-complete`, {}, withAuth(token, { timeout: 30000 }))
  );
}

export async function completeTaskAndIssueCertificates(taskId, token, options = {}) {
  const body = {};
  if (Array.isArray(options.studentIds) && options.studentIds.length > 0) {
    body.studentIds = options.studentIds;
  }
  return request(
    apiClient.post(`/tasks/${taskId}/complete`, body, withAuth(token, { timeout: 180000 }))
  );
}

export async function getMyTasks(token) {
  return request(apiClient.get("/tasks/my", withAuth(token)));
}

export async function uploadTaskFile(taskId, file, token) {
  const formData = new FormData();
  formData.append("file", file);

  return request(
    apiClient.post(`/tasks/upload/${taskId}`, formData, withAuth(token, { timeout: 60000 }))
  );
}

export async function sendTaskChatMessage(taskId, message, token) {
  return request(apiClient.post(`/tasks/chat/${taskId}`, { message }, withAuth(token)));
}

export async function getTaskChatMessages(taskId, token) {
  return request(apiClient.get(`/tasks/chat/${taskId}`, withAuth(token)));
}

export async function getMarketplacePosts(token) {
  return request(apiClient.get("/marketplace", withAuth(token)));
}

export async function deleteMarketplacePost(postId, token) {
  return request(apiClient.delete(`/marketplace/${postId}/delete`, withAuth(token)));
}

export async function rewardNFTAndClose(postId, token) {
  return request(
    apiClient.post(`/marketplace/${postId}/reward-nft`, {}, withAuth(token, { timeout: 120000 }))
  );
}

export async function getMyNFTs(token) {
  return request(apiClient.get("/marketplace/me/nfts", withAuth(token)));
}

export async function getCommunities(token) {
  return request(apiClient.get("/communities", withAuth(token)));
}

export async function getCommunitiesMap(token) {
  return request(apiClient.get("/communities/map", withAuth(token)));
}

export async function createCommunityForm(data, token) {
  const config = withAuth(token);
  if (data instanceof FormData) {
    config.headers = config.headers || {};
    delete config.headers["Content-Type"];
  }
  return request(apiClient.post("/communities", data, config));
}

export async function sendCommunityMessage(communityId, text, token) {
  return request(apiClient.post(`/communities/${communityId}/messages`, { text }, withAuth(token)));
}

export async function deleteCommunityMessage(communityId, messageId, token) {
  return request(
    apiClient.delete(`/communities/${communityId}/messages/${messageId}`, withAuth(token))
  );
}

export async function deleteCollabMessage(communityId, collabId, messageId, token) {
  return request(
    apiClient.delete(
      `/communities/${communityId}/collab/${collabId}/message/${messageId}`,
      withAuth(token)
    )
  );
}

export async function saveWalletAddress(walletAddress, token) {
  return request(apiClient.put("/user/wallet", { walletAddress }, withAuth(token)));
}

export async function getUserNFTCertificates(token) {
  return request(apiClient.get("/user/nfts", withAuth(token)));
}

export async function mintNFTCertificate(communityId, token, userId = null) {
  const body = { communityId };
  if (userId) {
    body.userId = userId;
  }

  return request(apiClient.post("/blockchain/mint", body, withAuth(token, { timeout: 180000 })));
}

export async function getBlockchainStatus(token) {
  return request(apiClient.get("/blockchain/status", withAuth(token, { timeout: 30000 })));
}

export async function getUserCertificates(token) {
  return request(apiClient.get("/user/certificates", withAuth(token)));
}

export async function verifyCertificate(certificateId) {
  return request(apiClient.get(`/certificates/${certificateId}`));
}

export async function saveCertificateAfterMint(data, token) {
  return request(
    apiClient.post(
      "/certificates/save",
      data,
      withAuth(token, { timeout: 30000 })
    )
  );
}

export async function syncCertificateStatus(token) {
  return request(
    apiClient.post("/certificates/sync", {}, withAuth(token, { timeout: 30000 }))
  );
}

export async function getNotifications(token) {
  return request(apiClient.get("/notifications", withAuth(token)));
}

export async function markNotificationRead(notificationId, token) {
  return request(apiClient.put(`/notifications/${notificationId}/read`, {}, withAuth(token)));
}

export async function markAllNotificationsRead(token) {
  return request(apiClient.put("/notifications/read-all", {}, withAuth(token)));
}

export async function getConnectionsOverview(token, search = "") {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  return request(apiClient.get(`/connections/overview${query}`, withAuth(token)));
}

export async function getDashboardConnectionStats(token) {
  return request(apiClient.get("/connections/dashboard-stats", withAuth(token)));
}

export async function getUserProfileWithFollowStatus(userId, token) {
  return request(apiClient.get(`/connections/user/${userId}`, withAuth(token)));
}

export async function followStudent(targetUserId, token) {
  return request(apiClient.post(`/connections/${targetUserId}/follow`, {}, withAuth(token)));
}

export async function unfollowStudent(targetUserId, token) {
  return request(apiClient.delete(`/connections/${targetUserId}/follow`, withAuth(token)));
}

export async function getConversations(token) {
  return request(apiClient.get("/dm/conversations", withAuth(token)));
}

export async function searchUsersForDM(query, token) {
  return request(apiClient.get(`/dm/search?q=${encodeURIComponent(query)}`, withAuth(token)));
}

// ── Wallet Login API (direct, no nonce) ──
export async function walletLogin(data) {
  return request(apiClient.post("/auth/wallet-login", data));
}

// ── Check if wallet exists ──
export async function checkWallet(walletAddress) {
  return request(apiClient.post("/auth/check-wallet", { walletAddress }));
}

// ── SIWE Auth API ──
export async function siweGetNonce(walletAddress) {
  return request(apiClient.post("/auth/siwe/nonce", { walletAddress }));
}

export async function siweVerifySignature(data) {
  return request(apiClient.post("/auth/siwe/verify", data));
}

export async function siweGetProfile(token) {
  return request(apiClient.get("/auth/siwe/me", withAuth(token)));
}

// ── Verification API ──
export async function submitVerification(formData, token) {
  return request(apiClient.post("/verify/submit", formData, withAuth(token)));
}

export async function getVerificationStatus(token) {
  return request(apiClient.get("/verify/status", withAuth(token)));
}

export async function saveSignatureImage(data, token) {
  return request(apiClient.post("/verify/signature", data, withAuth(token)));
}

export async function completeOnboarding(token) {
  return request(apiClient.post("/verify/complete", {}, withAuth(token)));
}

export async function reVerify(token) {
  return request(apiClient.post("/verify/re-verify", {}, withAuth(token)));
}

export async function checkVerification(token) {
  return request(apiClient.get("/verify/check", withAuth(token)));
}

export async function updateCommunityPosition(communityId, x, y, token) {
  return request(apiClient.put(`/communities/${communityId}/position`, { x, y }, withAuth(token)));
}

export async function updateProfile(data, token) {
  return request(apiClient.put("/user/profile", data, withAuth(token)));
}

export async function deleteAccount(token) {
  return request(apiClient.delete("/user/account", withAuth(token)));
}

export async function checkUsername(username, token) {
  return request(apiClient.get(`/user/check-username?username=${encodeURIComponent(username)}`, withAuth(token)));
}

export async function getUserStats(userId, token) {
  return request(apiClient.get(`/user/${userId}/stats`, withAuth(token)));
}

export async function getFollowedUsers(token) {
  return request(apiClient.get("/dm/followed", withAuth(token)));
}

export async function getMessages(userId, token, page = 1, limit = 30) {
  return request(apiClient.get(`/dm/${userId}?page=${page}&limit=${limit}`, withAuth(token)));
}

export async function sendMessage(receiver, text, token, options = {}) {
  return request(apiClient.post("/dm/send", { receiver, text, ...options }, withAuth(token)));
}

export async function deleteMessage(messageId, token) {
  return request(apiClient.delete(`/dm/${messageId}`, withAuth(token)));
}

export async function getFriendRequests(token) {
  return request(apiClient.get("/dm/friends/requests", withAuth(token)));
}

export async function sendFriendRequest(recipientId, token) {
  return request(apiClient.post("/dm/friends/request", { recipientId }, withAuth(token)));
}

export async function respondFriendRequest(requestId, accept, token) {
  return request(apiClient.post("/dm/friends/respond", { requestId, accept }, withAuth(token)));
}

export async function getFriendsList(token) {
  return request(apiClient.get("/dm/friends/list", withAuth(token)));
}

export async function removeFriend(friendId, token) {
  return request(apiClient.delete(`/dm/friends/${friendId}`, withAuth(token)));
}

// ── Server API ──
export async function getServers(token) {
  return request(apiClient.get("/servers", withAuth(token)));
}

export async function discoverServers(token) {
  return request(apiClient.get("/servers/discover", withAuth(token)));
}

export async function getServer(serverId, token) {
  return request(apiClient.get(`/servers/${serverId}`, withAuth(token)));
}

export async function createServer(data, token) {
  return request(apiClient.post("/servers", data, withAuth(token)));
}

export async function joinServer(serverId, token) {
  return request(apiClient.post(`/servers/${serverId}/join`, {}, withAuth(token)));
}

export async function joinServerByCode(code, token) {
  return request(apiClient.post(`/servers/join/${code}`, {}, withAuth(token)));
}

export async function leaveServer(serverId, token) {
  return request(apiClient.post(`/servers/${serverId}/leave`, {}, withAuth(token)));
}

export async function deleteServer(serverId, token) {
  return request(apiClient.delete(`/servers/${serverId}`, withAuth(token)));
}

export async function addChannel(serverId, data, token) {
  return request(apiClient.post(`/servers/${serverId}/channels`, data, withAuth(token)));
}

export async function removeChannel(serverId, channelId, token) {
  return request(apiClient.delete(`/servers/${serverId}/channels/${channelId}`, withAuth(token)));
}

export async function getServerMessages(serverId, channel, token, page = 1, limit = 30) {
  return request(apiClient.get(`/servers/${serverId}/messages/${channel}?page=${page}&limit=${limit}`, withAuth(token)));
}

export async function sendServerMessage(serverId, channel, data, token) {
  return request(apiClient.post(`/servers/${serverId}/messages/${channel}`, data, withAuth(token)));
}

export async function deleteServerMessage(serverId, messageId, token) {
  return request(apiClient.delete(`/servers/${serverId}/messages/${messageId}`, withAuth(token)));
}

export async function expandNetwork(userId, token, page = 1, limit = 20) {
  return request(apiClient.get(`/network/${userId}/expand?page=${page}&limit=${limit}`, withAuth(token)));
}

export async function getUserPublicProfile(userId, token) {
  return request(apiClient.get(`/social/profile/${userId}`, withAuth(token)));
}

export async function getUserFollowers(userId, token, page = 1, limit = 20) {
  return request(apiClient.get(`/social/${userId}/followers?page=${page}&limit=${limit}`, withAuth(token)));
}

export async function getUserFollowing(userId, token, page = 1, limit = 20) {
  return request(apiClient.get(`/social/${userId}/following?page=${page}&limit=${limit}`, withAuth(token)));
}

export async function getUserMutuals(userId, token, page = 1, limit = 20) {
  return request(apiClient.get(`/social/${userId}/mutuals?page=${page}&limit=${limit}`, withAuth(token)));
}


