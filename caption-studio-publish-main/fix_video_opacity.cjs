const fs = require('fs');
const path = require('path');
const videoPath = path.join(__dirname, 'src/components/dashboard/VideoPlayer.jsx');
let videoJsx = fs.readFileSync(videoPath, 'utf8');

// Target the style block for the outer span of each word
const targetStyle = `                                style={{
                                  display: 'inline-block',
                                  position: 'relative',
                                  transform: \`translate(\${x}px, \${y}px)\`,
                                  transition: (draggingWord || isDragging) ? 'none' : 'transform 0.1s ease',`;

const replacementStyle = `                                style={{
                                  display: (captionStyle?.display_mode === 'word_by_word' && !isActiveWord) ? 'none' : 'inline-block',
                                  opacity: (captionStyle?.show_inactive === false && hasTemplate && !isActiveWord && !isDoneWord) ? 0 : 1,
                                  position: 'relative',
                                  transform: \`translate(\${x}px, \${y}px)\`,
                                  transition: (draggingWord || isDragging) ? 'none' : 'transform 0.1s ease',`;

videoJsx = videoJsx.replace(targetStyle, replacementStyle);
fs.writeFileSync(videoPath, videoJsx, 'utf8');
console.log('VideoPlayer inline styles patched successfully');
