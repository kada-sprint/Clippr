# Camera-Band Trade-off (Template A)

Template A (Slide+Cam) derives the slide crop region from `CAMERA_BOX_POSITION.y` — cropping the full horizontal band the camera sits in, not just the camera rectangle. This excludes slide content beside the camera in that band, even though the camera isn't covering it.

FFmpeg's crop filter cannot remove a hole from the middle of a frame. The only alternative would be pixel-level subtraction, which is fragile and out of scope. Cropping the full horizontal band is the simplest approach that works reliably.

No face/screen detection is in scope per the FRD risk table. The camera box position is a documented fixed assumption. If it doesn't match a real recording, the result is visibly wrong but not broken — documented as a known limitation in test notes.
