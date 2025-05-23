import React, { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion } from 'framer-motion';
import { isDemoMode, demoSrtEntries } from './config/demo-mode';

interface SrtEntry {
  id: number;
  startTime: string;
  endTime: string;
  text: string;
  translatedText?: string;
}

interface SrtUploadProps {
  onSrtParsed: (entries: SrtEntry[]) => void;
}

const SrtUpload: React.FC<SrtUploadProps> = ({ onSrtParsed }) => {
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [demoLoaded, setDemoLoaded] = useState<boolean>(false);

  // 在demo模式下自动加载示例数据
  useEffect(() => {
    if (isDemoMode && !demoLoaded) {
      console.log('Demo mode active: Loading sample SRT entries');
      setFileName('demo-subtitle-sample.srt');
      onSrtParsed(demoSrtEntries);
      setDemoLoaded(true);
    }
  }, [isDemoMode, demoLoaded, onSrtParsed]);

  const parseSrt = (srtContent: string): SrtEntry[] => {
    const entries: SrtEntry[] = [];
    const lines = srtContent.split(/\r?\n/);
    let i = 0;
    while (i < lines.length) {
      const idLine = lines[i];
      if (!idLine || idLine.trim() === 
          '') { // Handle potential empty lines between entries or at the end
          i++;
          continue;
      }
      const id = parseInt(idLine, 10);
      if (isNaN(id)) { // Invalid entry, skip
          // console.warn("Skipping invalid SRT ID line:", idLine);
          // Skip until next potential ID or known pattern
          let skipped = 0;
          while(i < lines.length && (isNaN(parseInt(lines[i], 10)) || !lines[i+1]?.includes('-->'))) {
              i++;
              skipped++;
              if (skipped > 10) break; // Avoid infinite loop on malformed files
          }
          if (skipped > 10) { 
            // console.warn("Malformed SRT, could not find next valid entry after skipping 10 lines.");
            break; 
          }
          continue;
      }

      i++;
      const timeLine = lines[i];
      if (!timeLine || !timeLine.includes('-->')) {
        // console.warn("Skipping entry with invalid time line:", timeLine, "for ID:", id);
        // Try to find next ID
        while(i < lines.length && (isNaN(parseInt(lines[i], 10)) || !lines[i+1]?.includes('-->'))) {
            i++;
        }
        continue;
      }
      const [startTime, endTime] = timeLine.split(' --> ');
      i++;
      let textLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== '') {
        textLines.push(lines[i]);
        i++;
      }
      entries.push({ id, startTime, endTime, text: textLines.join('\n') });
      i++; // Move to the next block (should be an empty line or next ID)
    }
    return entries;
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    // 如果在demo模式下，不处理实际文件上传
    if (isDemoMode) {
      setError('在演示模式下，上传功能已被禁用。这是一个展示界面的demo网站。');
      return;
    }

    setError(null);
    setFileName(null);
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      if (file.name.endsWith('.srt')) {
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as string;
          if (content) {
            try {
                const parsedEntries = parseSrt(content);
                if (parsedEntries.length === 0 && content.trim() !== '') {
                    setError('Failed to parse SRT file. Ensure it is a valid SRT format.');
                } else {
                    onSrtParsed(parsedEntries);
                }
            } catch (e) {
                console.error("Error parsing SRT:", e);
                setError('Error processing SRT file. It might be corrupted or not a valid SRT.');
            }
          } else {
            setError('File is empty or could not be read.');
          }
        };
        reader.onerror = () => {
            setError('Failed to read file.');
        }
        reader.readAsText(file);
      } else {
        setError('Invalid file type. Please upload a .srt file.');
      }
    }
  }, [onSrtParsed]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/srt': ['.srt'],
    },
    multiple: false,
    // 在demo模式下禁用拖放功能
    disabled: isDemoMode && demoLoaded,
  });

  return (
    <motion.div
      className={`my-8 text-center transition-colors 
        ${isDragActive ? 'border-blue-600' : 'border-gray-300 hover:border-blue-500'}`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div
        {...getRootProps()} 
        className={`p-10 border-2 border-dashed rounded-lg cursor-pointer 
          ${isDragActive ? 'bg-blue-50' : ''}
          ${isDemoMode && demoLoaded ? 'opacity-60' : ''}`}
      >
        <input {...getInputProps()} />
        {isDragActive ? (
          <p className="text-blue-700 font-semibold">Drop the .srt file here ...</p>
        ) : fileName ? (
          <p className="text-green-700 font-semibold">
            File: {fileName} 
            {isDemoMode ? ' (Demo Mode)' : ' (Click to select another)'}
          </p>
        ) : (
          <p className="text-gray-500">
            {isDemoMode 
              ? '这是演示模式 - 已自动加载示例字幕文件' 
              : 'Drag & drop your .srt file here, or click to select file.'}
          </p>
        )}
        {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}
        {isDemoMode && demoLoaded && (
          <div className="mt-4 bg-yellow-50 p-2 rounded-md text-sm text-yellow-700">
            <p>⚠️ 演示模式已激活 - 这是一个展示用网站</p>
            <p>真实的翻译功能已被模拟效果替代</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default SrtUpload;

