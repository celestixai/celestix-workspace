import React, { useState, useEffect, useRef } from 'react';
import {
  Play, Upload, Search, Trash2, Eye, Clock, Calendar, MessageSquare,
  Film, FolderOpen, X, ChevronLeft, Send, Hash, User, MoreHorizontal,
} from 'lucide-react';
import { api } from '@/lib/api';

interface Video {
  id: string;
  title: string;
  description: string;
  tags: string[];
  url: string;
  thumbnailUrl?: string;
  duration: number;
  views: number;
  uploadedBy: string;
  uploadedAt: string;
  channelId?: string;
}

interface Comment {
  id: string;
  videoId: string;
  author: string;
  text: string;
  timestamp?: number;
  createdAt: string;
}

interface Channel {
  id: string;
  name: string;
  videoCount: number;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatViews(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

const placeholderGradients = [
  'from-blue-600/40 to-purple-600/40',
  'from-green-600/40 to-teal-600/40',
  'from-orange-600/40 to-red-600/40',
  'from-pink-600/40 to-violet-600/40',
  'from-cyan-600/40 to-blue-600/40',
];

export function StreamPage() {
  const [view, setView] = useState<'library' | 'player'>('library');
  const [videos, setVideos] = useState<Video[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [commentTimestamp, setCommentTimestamp] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    api.get('/stream/videos').then((res) => setVideos(res.data));
    api.get('/stream/channels').then((res) => setChannels(res.data));
  }, []);

  const openVideo = async (video: Video) => {
    setSelectedVideo(video);
    setView('player');
    api.post(`/stream/videos/${video.id}/view`);
    const res = await api.get(`/stream/videos/${video.id}/comments`);
    setComments(res.data);
  };

  const goBack = () => {
    setView('library');
    setSelectedVideo(null);
    setComments([]);
    api.get('/stream/videos').then((res) => setVideos(res.data));
  };

  const handleUpload = async () => {
    if (!uploadFile || !uploadTitle.trim()) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('title', uploadTitle);
    formData.append('description', uploadDesc);

    try {
      const res = await api.post('/stream/videos', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent: any) => {
          const pct = progressEvent.total ? Math.round((progressEvent.loaded * 100) / progressEvent.total) : 0;
          setUploadProgress(pct);
        },
      });
      setVideos((prev) => [res.data, ...prev]);
      setShowUpload(false);
      setUploadTitle('');
      setUploadDesc('');
      setUploadFile(null);
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  const deleteVideo = async (id: string) => {
    await api.delete(`/stream/videos/${id}`);
    setVideos((prev) => prev.filter((v) => v.id !== id));
    if (selectedVideo?.id === id) goBack();
  };

  const addComment = async () => {
    if (!selectedVideo || !newComment.trim()) return;
    const payload: any = { text: newComment };
    if (commentTimestamp) payload.timestamp = parseFloat(commentTimestamp);
    const res = await api.post(`/stream/videos/${selectedVideo.id}/comments`, payload);
    setComments((prev) => [...prev, res.data]);
    setNewComment('');
    setCommentTimestamp('');
  };

  const seekToTimestamp = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play();
    }
  };

  const filteredVideos = videos.filter((v) => {
    const matchesSearch = !searchQuery || v.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesChannel = !selectedChannel || v.channelId === selectedChannel;
    return matchesSearch && matchesChannel;
  });

  // --- LIBRARY VIEW ---
  if (view === 'library') {
    return (
      <div className="flex h-full bg-[#0a0a0f] text-white">
        {/* Channels Sidebar */}
        <div className="w-56 bg-[#12121a] border-r border-white/10 flex flex-col">
          <div className="p-4 border-b border-white/10">
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Channels</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <button
              onClick={() => setSelectedChannel(null)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                !selectedChannel ? 'bg-blue-600/20 text-blue-400' : 'text-white/70 hover:bg-white/5'
              }`}
            >
              <Film size={14} />
              <span>All Videos</span>
            </button>
            {channels.map((ch) => (
              <button
                key={ch.id}
                onClick={() => setSelectedChannel(ch.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedChannel === ch.id ? 'bg-blue-600/20 text-blue-400' : 'text-white/70 hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FolderOpen size={14} />
                  <span className="truncate">{ch.name}</span>
                </div>
                <span className="text-xs text-white/30">{ch.videoCount}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-white/10 flex items-center justify-between gap-4">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm outline-none focus:border-blue-600 text-white placeholder:text-white/30"
                placeholder="Search videos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
            >
              <Upload size={16} />
              Upload
            </button>
          </div>

          {/* Video Grid */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredVideos.map((video, idx) => (
                <div
                  key={video.id}
                  onClick={() => openVideo(video)}
                  className="bg-[#1a1a2e] border border-white/10 rounded-xl overflow-hidden cursor-pointer hover:border-white/20 transition-all group"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video">
                    {video.thumbnailUrl ? (
                      <img src={video.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-br ${placeholderGradients[idx % placeholderGradients.length]} flex items-center justify-center`}>
                        <Play size={32} className="text-white/30" />
                      </div>
                    )}
                    <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
                      {formatDuration(video.duration)}
                    </span>
                  </div>
                  {/* Info */}
                  <div className="p-3">
                    <h3 className="text-sm font-medium text-white truncate group-hover:text-blue-400 transition-colors">
                      {video.title}
                    </h3>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-white/40">
                      <span className="flex items-center gap-1"><Eye size={12} /> {formatViews(video.views)}</span>
                      <span className="flex items-center gap-1"><Calendar size={12} /> {formatDate(video.uploadedAt)}</span>
                    </div>
                    <p className="text-xs text-white/30 mt-1 truncate">{video.uploadedBy}</p>
                  </div>
                </div>
              ))}
            </div>
            {filteredVideos.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-white/20">
                <Film size={48} className="mb-4" />
                <p className="text-lg">No videos found</p>
              </div>
            )}
          </div>
        </div>

        {/* Upload Dialog */}
        {showUpload && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-[#12121a] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Upload Video</h3>
                <button onClick={() => setShowUpload(false)} className="text-white/30 hover:text-white/50">
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-4">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center cursor-pointer hover:border-white/20 transition-colors"
                >
                  <Upload size={24} className="mx-auto text-white/20 mb-2" />
                  <p className="text-sm text-white/40">
                    {uploadFile ? uploadFile.name : 'Click to select a video file'}
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  />
                </div>
                <input
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-600"
                  placeholder="Video title"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                />
                <textarea
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-600 resize-none h-20"
                  placeholder="Description (optional)"
                  value={uploadDesc}
                  onChange={(e) => setUploadDesc(e.target.value)}
                />
                {uploading && (
                  <div className="space-y-1">
                    <div className="w-full bg-white/5 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-white/40 text-center">{uploadProgress}% uploaded</p>
                  </div>
                )}
                <button
                  onClick={handleUpload}
                  disabled={!uploadFile || !uploadTitle.trim() || uploading}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-white/10 disabled:text-white/30 rounded-lg text-sm font-medium transition-colors"
                >
                  {uploading ? 'Uploading...' : 'Upload Video'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- PLAYER VIEW ---
  return (
    <div className="flex h-full bg-[#0a0a0f] text-white overflow-hidden">
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Back Button */}
        <div className="p-4 border-b border-white/10">
          <button
            onClick={goBack}
            className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors"
          >
            <ChevronLeft size={16} />
            Back to Library
          </button>
        </div>

        {selectedVideo && (
          <>
            {/* Video Player */}
            <div className="w-full bg-black aspect-video max-h-[60vh]">
              <video
                ref={videoRef}
                src={selectedVideo.url}
                controls
                className="w-full h-full"
                autoPlay
              />
            </div>

            {/* Video Details */}
            <div className="p-6 border-b border-white/10">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h1 className="text-xl font-bold">{selectedVideo.title}</h1>
                  <div className="flex items-center gap-4 mt-2 text-sm text-white/50">
                    <span className="flex items-center gap-1"><Eye size={14} /> {formatViews(selectedVideo.views)} views</span>
                    <span className="flex items-center gap-1"><Calendar size={14} /> {formatDate(selectedVideo.uploadedAt)}</span>
                    <span className="flex items-center gap-1"><User size={14} /> {selectedVideo.uploadedBy}</span>
                  </div>
                  {selectedVideo.tags && selectedVideo.tags.length > 0 && (
                    <div className="flex gap-2 mt-3">
                      {selectedVideo.tags.map((tag) => (
                        <span key={tag} className="px-2 py-0.5 bg-white/5 rounded text-xs text-white/40">
                          <Hash size={10} className="inline mr-0.5" />{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => deleteVideo(selectedVideo.id)}
                  className="p-2 rounded-lg hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              {selectedVideo.description && (
                <p className="mt-4 text-sm text-white/60 leading-relaxed">{selectedVideo.description}</p>
              )}
            </div>

            {/* Comments */}
            <div className="p-6">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-white/70 mb-4">
                <MessageSquare size={16} />
                Comments ({comments.length})
              </h3>

              {/* Add Comment */}
              <div className="flex gap-3 mb-6">
                <div className="flex-1 space-y-2">
                  <textarea
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-600 resize-none h-16"
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                  />
                  <div className="flex items-center justify-between">
                    <input
                      className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs outline-none focus:border-blue-600 w-32"
                      placeholder="Timestamp (sec)"
                      value={commentTimestamp}
                      onChange={(e) => setCommentTimestamp(e.target.value)}
                    />
                    <button
                      onClick={addComment}
                      disabled={!newComment.trim()}
                      className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-white/10 disabled:text-white/30 rounded-lg text-xs font-medium transition-colors"
                    >
                      <Send size={12} />
                      Comment
                    </button>
                  </div>
                </div>
              </div>

              {/* Comment List */}
              <div className="space-y-4">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs text-white/40 shrink-0">
                      {comment.author.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{comment.author}</span>
                        <span className="text-xs text-white/30">{formatDate(comment.createdAt)}</span>
                        {comment.timestamp != null && (
                          <button
                            onClick={() => seekToTimestamp(comment.timestamp!)}
                            className="text-xs text-blue-400 hover:text-blue-300"
                          >
                            {formatDuration(comment.timestamp)}
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-white/70 mt-1">{comment.text}</p>
                    </div>
                  </div>
                ))}
                {comments.length === 0 && (
                  <p className="text-sm text-white/30 text-center py-4">No comments yet. Be the first to comment.</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
