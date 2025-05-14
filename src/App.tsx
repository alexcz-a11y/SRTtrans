import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger'; // Import ScrollTrigger
// import { animate as animeAnimate, createScope as animeCreateScope } from 'animejs'; // Temporarily removing anime.js attempt
import './App.css';
import SrtUpload from './SrtUpload'; // Import the SrtUpload component

// Define the ApiError interface
interface ApiError {
  code?: number; // HTTP status code or custom error code
  type: 'NetworkError' | 'APIError' | 'PermissionError' | 'RateLimitError' | 'ModelError' | 'ServerError' | 'StreamParseError' | 'UnknownError';
  message: string;
  retryable?: boolean;
}

// Define the SrtEntry interface (can be moved to a types file later)
interface SrtEntry {
  id: number;
  startTime: string;
  endTime: string;
  text: string;
  translatedText?: string; // Optional: to store translated text
  error?: ApiError; // New field for detailed error
}

// Define the structure for API settings
interface ApiSettings {
  baseUrl: string;
  apiKey: string;
  systemPrompt: string;
  modelName: string; // User wants to specify model name
}

// Define language options
const languageOptions = [
  { value: 'auto', label: 'Auto Detect' },
  { value: 'en', label: 'English' },
  { value: 'zh-CN', label: 'Chinese (Simplified)' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  // Add more languages as needed
];

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function App() {
  const [srtEntries, setSrtEntries] = useState<SrtEntry[]>([]);
  const [translatedSrtEntries, setTranslatedSrtEntries] = useState<SrtEntry[]>([]);
  const [apiSettings, setApiSettings] = useState<ApiSettings>({
    baseUrl: 'https://api.openai.com/v1', // Default, user can change
    apiKey: '', // User must provide
    systemPrompt: "You will be provided with a main subtitle entry to translate, potentially accompanied by preceding and succeeding subtitle lines for context. Translate *only* the main subtitle entry, which will be clearly indicated. Use the context to improve the accuracy and naturalness of the translation for the main entry. Original format: {source_language}. Target format: {target_language}. Only provide the translated text for the main entry.", // Updated default system prompt
    modelName: 'gpt-3.5-turbo', // Default, user can change
  });
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [isTranslating, setIsTranslating] = useState(false);
  const [currentTranslationId, setCurrentTranslationId] = useState<number | null>(null);
  const [connectivityStatus, setConnectivityStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [showSettings, setShowSettings] = useState(true); // State for settings panel visibility
  const [autoRetryEnabled, setAutoRetryEnabled] = useState(true); // Default to true
  const [contextualTranslationEnabled, setContextualTranslationEnabled] = useState(false);
  const [precedingContextLines, setPrecedingContextLines] = useState(1);
  const [succeedingContextLines, setSucceedingContextLines] = useState(1);

  // Refs for GSAP animations
  const mainContainerRef = useRef<HTMLDivElement>(null); // Typed for main div
  const appContentRef = useRef<HTMLDivElement>(null); // Ref for the main content block for staggered entrance
  const settingsPanelRef = useRef<HTMLDivElement>(null); 
  const settingsToggleIconRef = useRef<SVGSVGElement>(null); 
  const uploadSectionRef = useRef<HTMLDivElement>(null);
  const settingsSectionRef = useRef<HTMLDivElement>(null);
  const outputSectionRef = useRef<HTMLDivElement>(null);
  const testConnectivityButtonRef = useRef<HTMLButtonElement>(null);
  const testConnectivityButtonTextRef = useRef<HTMLSpanElement>(null); // Ref for its text span, if magnetic effect is added
  const startTranslationButtonRef = useRef<HTMLButtonElement>(null); 
  const startTranslationButtonTextRef = useRef<HTMLSpanElement>(null); // Ref for its text span

  useEffect(() => {
    console.log("[GSAP Debug] Main useEffect started.");
    gsap.registerPlugin(ScrollTrigger); 
    console.log("[GSAP Debug] ScrollTrigger registered.");

    // Header title animation
    console.log("[GSAP Debug] Initializing header title animation...");
    const headerAnim = gsap.fromTo('.app-header-title', 
      { opacity: 0, y: -30 }, 
      { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', delay: 0.2 }
    );
    console.log("[GSAP Debug] Header title animation initialized.");

    let entranceAnim: gsap.core.Tween | null = null;
    let settingsScrollAnim: gsap.core.Tween | null = null;
    let testBtnHoverTl: gsap.core.Timeline | null = null;
    let playAnim: (() => void) | null = null;
    let reverseAnim: (() => void) | null = null;

    // Staggered entrance for main content sections
    console.log("[GSAP Debug] Checking refs for staggered entrance: appContentRef:", appContentRef.current, "uploadSectionRef:", uploadSectionRef.current, "settingsSectionRef:", settingsSectionRef.current);
    if (appContentRef.current) {
      const sectionsToAnimate = [uploadSectionRef.current, settingsSectionRef.current].filter(el => el);
      console.log("[GSAP Debug] Staggered entrance: sections to animate (excluding output):", sectionsToAnimate);
      if (sectionsToAnimate.length > 0) {
        entranceAnim = gsap.from(
          sectionsToAnimate,
          {
            opacity: 0,
            y: 50,
            duration: 0.7,
            ease: 'power3.out',
            stagger: 0.2, 
            delay: 0.5, 
          }
        );
        console.log("[GSAP Debug] Staggered entrance animation initialized for upload and settings sections.");
      } else {
        console.log("[GSAP Debug] Staggered entrance: No valid upload/settings sections found to animate.");
      }
    } else {
      console.log("[GSAP Debug] Staggered entrance: appContentRef is null.");
    }

    // Scroll-triggered animation for settings section
    console.log("[GSAP Debug] Checking ref for settings section ScrollTrigger: settingsSectionRef:", settingsSectionRef.current);
    if (settingsSectionRef.current) {
      const formElements = settingsSectionRef.current.querySelectorAll('.form-element-group');
      console.log("[GSAP Debug] Settings ScrollTrigger: form elements found:", formElements);
      if (formElements.length > 0) {
        settingsScrollAnim = gsap.from(formElements, { 
          scrollTrigger: {
            trigger: settingsSectionRef.current,
            start: "top 80%", 
            // markers: true, 
            toggleActions: "play none none none" 
          },
          opacity: 0,
          y: 30,
          stagger: 0.15,
          duration: 0.6,
          ease: 'circ.out'
        });
        console.log("[GSAP Debug] Settings section ScrollTrigger animation initialized.");
      } else {
        console.log("[GSAP Debug] Settings ScrollTrigger: No .form-element-group found.");
      }
    } else {
      console.log("[GSAP Debug] Settings ScrollTrigger: settingsSectionRef is null.");
    }
    
    // GSAP hover animation for Test Connectivity button
    console.log("[GSAP Debug] Checking ref for Test Connectivity button hover: testConnectivityButtonRef:", testConnectivityButtonRef.current);
    if (testConnectivityButtonRef.current) {
      console.log("[GSAP Debug] GSAP hover for Test Connectivity button REMOVED, Framer Motion will handle it.");
    } else {
      console.log("[GSAP Debug] Test Connectivity button hover: testConnectivityButtonRef is null.");
    }
    console.log("[GSAP Debug] Main useEffect setup finished.");

    return () => {
      console.log("[GSAP Debug] Main useEffect cleanup started.");
      headerAnim?.kill();
      entranceAnim?.kill();
      settingsScrollAnim?.kill();
      gsap.set('.app-header-title', {clearProps: "all"});
      if (appContentRef.current) {
          const sectionsToClear = [uploadSectionRef.current, settingsSectionRef.current].filter(el => el);
          if(sectionsToClear.length > 0) gsap.set(sectionsToClear, {clearProps: "all"});
      }
      if (settingsSectionRef.current) {
          gsap.set(settingsSectionRef.current.querySelectorAll('.form-element-group'), {clearProps: "all"});
      }
      
      if (testConnectivityButtonRef.current && playAnim && reverseAnim) {
        // Cleanup for GSAP hover - this block will be effectively empty now or removed if playAnim/reverseAnim are not set
        // console.log("[GSAP Debug] Cleaning up Test Connectivity button hover listeners and timeline.");
        // testConnectivityButtonRef.current.removeEventListener('mouseenter', playAnim);
        // testConnectivityButtonRef.current.removeEventListener('mouseleave', reverseAnim);
        // testBtnHoverTl?.kill();
        // gsap.set(testConnectivityButtonRef.current, {clearProps: "all"});
      }
      if (testConnectivityButtonRef.current) { // General cleanup if GSAP did anything to it
          gsap.set(testConnectivityButtonRef.current, {clearProps: "all"});
      }

      // Cleanup for Start Translation button magnetic text effect
      if (startTranslationButtonRef.current) {
        // remove event listeners, specific function references needed if created inside useEffect
        // For simplicity, this example assumes they are defined if the effect ran.
        // A more robust way is to define handler functions outside or ensure they are stable.
      }

      ScrollTrigger.getAll().forEach(st => st.kill());
      console.log("[GSAP Debug] Main useEffect cleanup finished.");
    };
  }, []); 

  // useEffect for Start Translation button magnetic text
  useEffect(() => {
    const button = startTranslationButtonRef.current;
    const textSpan = startTranslationButtonTextRef.current;

    if (!button || !textSpan) return;

    console.log("[GSAP Debug] Initializing magnetic text for Start Translation button.");

    const onMouseMove = (e: MouseEvent) => {
      const rect = button.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;

      gsap.to(textSpan, {
        x: x * 0.15, // Adjust multiplier for sensitivity
        y: y * 0.15,
        duration: 0.3,
        ease: "power2.out"
      });
    };

    const onMouseLeave = () => {
      gsap.to(textSpan, {
        x: 0,
        y: 0,
        duration: 0.5,
        ease: "elastic.out(1, 0.75)" // Elastic return
      });
    };

    button.addEventListener('mousemove', onMouseMove);
    button.addEventListener('mouseleave', onMouseLeave);
    console.log("[GSAP Debug] Magnetic text listeners added to Start Translation button.");

    return () => {
      console.log("[GSAP Debug] Cleaning up magnetic text listeners for Start Translation button.");
      button.removeEventListener('mousemove', onMouseMove);
      button.removeEventListener('mouseleave', onMouseLeave);
      gsap.set(textSpan, { clearProps: "x,y" }); // Clear GSAP transforms on cleanup
    };
  }, []); // Runs once after initial mount

  // useEffect for Test AI Provider Connectivity button magnetic text
  useEffect(() => {
    const button = testConnectivityButtonRef.current;
    const textSpan = testConnectivityButtonTextRef.current;

    if (!button || !textSpan) return;

    console.log("[GSAP Debug] Initializing magnetic text for Test AI Provider Connectivity button.");

    const onMouseMove = (e: MouseEvent) => {
      const rect = button.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;

      gsap.to(textSpan, {
        x: x * 0.15, 
        y: y * 0.15,
        duration: 0.3,
        ease: "power2.out"
      });
    };

    const onMouseLeave = () => {
      gsap.to(textSpan, {
        x: 0,
        y: 0,
        duration: 0.5,
        ease: "elastic.out(1, 0.75)" 
      });
    };

    button.addEventListener('mousemove', onMouseMove);
    button.addEventListener('mouseleave', onMouseLeave);
    console.log("[GSAP Debug] Magnetic text listeners added to Test AI Provider Connectivity button.");

    return () => {
      console.log("[GSAP Debug] Cleaning up magnetic text listeners for Test AI Provider Connectivity button.");
      button.removeEventListener('mousemove', onMouseMove);
      button.removeEventListener('mouseleave', onMouseLeave);
      gsap.set(textSpan, { clearProps: "x,y" }); 
    };
  }, []); // Runs once after initial mount

  // useEffect for outputSection animation, dependent on srtEntries
  useEffect(() => {
    console.log("[GSAP Debug] Output section useEffect. srtEntries length:", srtEntries.length, "outputSectionRef:", outputSectionRef.current);
    if (srtEntries.length > 0 && outputSectionRef.current) {
      const translationItems = outputSectionRef.current.querySelectorAll('.translation-item-gsap');
      console.log("[GSAP Debug] Output ScrollTrigger: translation items found:", translationItems.length);
      if (translationItems.length > 0) {
        // Clear any previous animations on these items before applying new ones
        gsap.set(translationItems, {clearProps: "all"}); 
        const outputScrollAnim = gsap.from(translationItems, { 
          scrollTrigger: {
            trigger: outputSectionRef.current,
            start: "top 85%",
            // markers: true,
            toggleActions: "play none none none",
          },
          opacity: 0,
          y: 20,
          stagger: 0.1,
          duration: 0.5,
          ease: 'sine.out'
        });
        console.log("[GSAP Debug] Output section ScrollTrigger animation initialized.");
        return () => {
            console.log("[GSAP Debug] Cleaning up output section animation.");
            outputScrollAnim.kill();
            // Optionally clear props if items might be re-animated differently later
            // gsap.set(translationItems, {clearProps: "all"}); 
        };
      } else {
        console.log("[GSAP Debug] Output ScrollTrigger: No .translation-item-gsap found this time.");
      }
    } else if (srtEntries.length === 0) {
        // Optionally, if you want to clear styles from translationItems when srtEntries is empty
        // This assumes outputSectionRef might still exist or you have a way to select old items
        // For simplicity, usually handled by conditional rendering or direct cleanup when items are removed.
    }
  }, [srtEntries]); // Re-run when srtEntries changes

  const toggleSettings = () => {
    const newShowSettings = !showSettings;
    setShowSettings(newShowSettings);

    if (settingsToggleIconRef.current) {
      gsap.to(settingsToggleIconRef.current, { // Using GSAP for rotation
        rotation: newShowSettings ? 0 : -180, // GSAP typically uses degrees directly
        duration: 0.3,
        ease: 'power2.inOut'
      });
    }
  };

  const handleSrtParsed = (entries: SrtEntry[]) => {
    setSrtEntries(entries);
    setTranslatedSrtEntries(entries.map(entry => ({ ...entry, translatedText: '', error: undefined }))); 
    console.log('Parsed SRT Entries:', entries);
  };

  const handleApiSettingChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setApiSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleLanguageChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    setter(e.target.value);
  };

  const testConnectivity = async () => {
    if (!apiSettings.apiKey || !apiSettings.baseUrl) {
      alert('Please provide API Key and Base URL for connectivity test.');
      setConnectivityStatus('error');
      return;
    }
    setConnectivityStatus('testing');
    try {
      const response = await fetch(`${apiSettings.baseUrl}/models`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${apiSettings.apiKey}` },
      });
      if (response.ok) {
        setConnectivityStatus('success');
        alert('Connectivity test successful!');
      } else {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        setConnectivityStatus('error');
        alert(`Connectivity test failed: ${errorData.message || response.statusText} (Status: ${response.status})`);
      }
    } catch (error: any) {
      setConnectivityStatus('error');
      alert(`Connectivity test failed: ${error.message}`);
    }
  };

  const translateSingleEntry = async (
    entryToProcess: SrtEntry, 
    signal: AbortSignal, 
    apiSettingsSnapshot: ApiSettings, 
    sourceLangSnapshot: string, 
    targetLangSnapshot: string,
    autoRetryEnabledSnapshot: boolean,
    // Contextual translation parameters
    contextualTranslationEnabledSnapshot: boolean,
    precedingContextLinesSnapshot: number,
    succeedingContextLinesSnapshot: number,
    allOriginalEntriesSnapshot: SrtEntry[] // To get context from
  ): Promise<SrtEntry> => {
    let updatedEntry: SrtEntry = { ...entryToProcess, translatedText: '', error: undefined };
      let accumulatedTranslation = '';
    let lastError: ApiError | undefined = undefined;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (signal.aborted) {
        updatedEntry.error = lastError || { type: 'UnknownError', message: 'Translation process aborted before/during retry attempt.' };
        break;
      }

      if (attempt > 0) { // If this is a retry attempt
        console.log(`Retrying entry ${entryToProcess.id}, attempt ${attempt} after ${RETRY_DELAY_MS / 1000}s delay...`);
        // Update UI to show retrying status for the specific entry
        setTranslatedSrtEntries(prevEntries => 
          prevEntries.map(pe => 
            pe.id === entryToProcess.id 
            ? { ...pe, translatedText: `Retrying attempt ${attempt}/${MAX_RETRIES}...`, error: undefined } 
            : pe
          )
        );
        await sleep(RETRY_DELAY_MS);
        if (signal.aborted) { // Check again after sleep
          updatedEntry.error = lastError || { type: 'UnknownError', message: 'Translation process aborted during retry delay.' };
          break;
        }
        accumulatedTranslation = ''; // Reset for retry
        updatedEntry.translatedText = ''; // Reset for retry
      }
      
      updatedEntry.error = undefined; // Clear previous attempt's error before new try

      try {
        const effectiveSystemPrompt = apiSettingsSnapshot.systemPrompt
          .replace('{source_language}', sourceLangSnapshot === 'auto' ? 'the original language' : languageOptions.find(l => l.value === sourceLangSnapshot)?.label || 'the original language')
          .replace('{target_language}', languageOptions.find(l => l.value === targetLangSnapshot)?.label || 'English');

        let userMessageContent = entryToProcess.text;

        if (contextualTranslationEnabledSnapshot && (precedingContextLinesSnapshot > 0 || succeedingContextLinesSnapshot > 0)) {
          let contextualUserInput = "";
          const currentIndex = allOriginalEntriesSnapshot.findIndex(e => e.id === entryToProcess.id);

          if (currentIndex !== -1) {
            if (precedingContextLinesSnapshot > 0) {
              contextualUserInput += "Context (Previous):\n";
              for (let i = Math.max(0, currentIndex - precedingContextLinesSnapshot); i < currentIndex; i++) {
                contextualUserInput += `${allOriginalEntriesSnapshot[i].text}\n`;
              }
              contextualUserInput += "---\n";
            }

            contextualUserInput += "Translate THIS Subtitle:\n";
            contextualUserInput += `${entryToProcess.text}\n`;

            if (succeedingContextLinesSnapshot > 0) {
              contextualUserInput += "---\nContext (Succeeding):\n";
              for (let i = currentIndex + 1; i < Math.min(allOriginalEntriesSnapshot.length, currentIndex + 1 + succeedingContextLinesSnapshot); i++) {
                contextualUserInput += `${allOriginalEntriesSnapshot[i].text}\n`;
              }
            }
            userMessageContent = contextualUserInput.trim();
          } else {
            console.warn(`Could not find entry with ID ${entryToProcess.id} in allOriginalEntriesSnapshot for contextual translation.`);
            // Fallback to just the entry text if something went wrong with indexing
          }
        }

        const response = await fetch(`${apiSettingsSnapshot.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiSettingsSnapshot.apiKey}` },
          signal: signal, // Pass the signal here
          body: JSON.stringify({
            model: apiSettingsSnapshot.modelName,
            messages: [
              { role: 'system', content: effectiveSystemPrompt },
              { role: 'user', content: userMessageContent }, 
            ],
            stream: true,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: response.statusText }));
          let errorType: ApiError['type'] = 'APIError';
          let retryable = false;
          if (response.status === 401) errorType = 'PermissionError';
          else if (response.status === 403) errorType = 'PermissionError';
          else if (response.status === 429) { errorType = 'RateLimitError'; retryable = true; }
          else if (response.status === 404 && errorData.message?.toLowerCase().includes('model not found')) errorType = 'ModelError';
          else if (response.status >= 500) { errorType = 'ServerError'; retryable = true; }
          
          lastError = { code: response.status, type: errorType, message: errorData.message || response.statusText || 'No specific error message from API.', retryable };
          updatedEntry.error = lastError;

          if (autoRetryEnabledSnapshot && lastError.retryable && attempt < MAX_RETRIES) {
            console.log(`Entry ${entryToProcess.id} failed with retryable error (${lastError.type}), will retry.`);
            continue; // Go to next attempt in the loop
          } else {
            console.log(`Entry ${entryToProcess.id} failed with non-retryable error or max retries reached.`);
            break; // Exit loop, error is final
          }
        } else {
        const reader = response.body?.getReader();
        if (!reader) {
            lastError = { type: 'UnknownError', message: 'Failed to get response reader' };
            updatedEntry.error = lastError;
            // This is likely not retryable by default unless we make it so
            if (autoRetryEnabledSnapshot && lastError.retryable && attempt < MAX_RETRIES) continue;
            break; 
        }
        const decoder = new TextDecoder();
          let streamDone = false;
          
          while (!streamDone) {
            if (signal.aborted) {
              if (!updatedEntry.error && !accumulatedTranslation) {
                   updatedEntry.error = { type: 'UnknownError', message: 'Translation aborted by user during streaming.' };
              }
              streamDone = true; 
              break;
            }
          const { done, value } = await reader.read();
            if (done) {
              streamDone = true;
              break;
            }
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(line => line.trim() !== '');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.substring(6);
                if (data === '[DONE]') {
                  streamDone = true; 
                  break; 
                }
              try {
                const parsed = JSON.parse(data);
                if (parsed.choices && parsed.choices[0].delta && parsed.choices[0].delta.content) {
                  accumulatedTranslation += parsed.choices[0].delta.content;
                    updatedEntry.translatedText = accumulatedTranslation;
                     // Live update UI with streamed content
                    setTranslatedSrtEntries(prevEntries => 
                      prevEntries.map(pe => 
                        pe.id === entryToProcess.id 
                        ? { ...pe, translatedText: accumulatedTranslation, error: undefined } 
                        : pe
                      )
                    );
                }
                } catch (e: any) {
                console.error('Error parsing stream data:', e, 'Raw data:', data);
                  lastError = { type: 'StreamParseError', message: `Error parsing stream: ${e.message}` };
                  updatedEntry.error = lastError;
                  streamDone = true; 
                  break;
                }
              }
            }
          }
          // If loop finished due to streamDone and not an error within streaming
          if (!updatedEntry.error) {
            console.log(`Entry ${entryToProcess.id} translated successfully on attempt ${attempt}.`);
            return updatedEntry; // Successful translation
          }
        }
      } catch (error: any) {
        console.error(`Error translating entry ${entryToProcess.id} on attempt ${attempt}:`, error);
        let apiError: ApiError;
        if (error.name === 'AbortError') {
          apiError = { type: 'UnknownError', message: 'Translation process aborted.' };
        } else if (error instanceof TypeError && (error.message.includes('fetch') || error.message.includes('NetworkError'))) { 
          apiError = { type: 'NetworkError', message: `Network error: ${error.message}`, retryable: true };
        } else {
          apiError = { type: 'UnknownError', message: error.message || 'An unknown error occurred during translation.' };
        }
        lastError = apiError;
        updatedEntry.error = lastError;

        if (autoRetryEnabledSnapshot && lastError.retryable && attempt < MAX_RETRIES) {
          console.log(`Entry ${entryToProcess.id} caught exception with retryable error (${lastError.type}), will retry.`);
          continue; // Go to next attempt
        } else {
          break; // Exit loop
        }
      }
    } // End of retry loop

    // If loop finished (either by break or max attempts) and there's an error, it's final.
    // If signal was aborted, that error would already be set.
    // Otherwise, the lastError is the final one.
    if (!updatedEntry.error && lastError) { // Ensure error is set if loop exhausted retries
        updatedEntry.error = lastError;
    }
    console.log(`Entry ${entryToProcess.id} finished processing. Final error:`, updatedEntry.error);
    return updatedEntry;
  };

  const startTranslation = async () => {
    if (!srtEntries.length || !apiSettings.apiKey || !apiSettings.baseUrl) {
      alert('Please upload an SRT file and provide API Key and Base URL.');
      return;
    }
    setIsTranslating(true);
    const initialProcessingEntries: SrtEntry[] = srtEntries.map(entry => ({ ...entry, translatedText: '', error: undefined }));
    setTranslatedSrtEntries([...initialProcessingEntries]);

    const controller = new AbortController();
    setAbortController(controller);
    
    // Snapshot current settings to avoid issues if user changes them mid-translation
    const currentApiSettings = { ...apiSettings };
    const currentSourceLang = sourceLanguage;
    const currentTargetLang = targetLanguage;
    const currentAutoRetryEnabled = autoRetryEnabled; 
    const currentContextualTranslationEnabled = contextualTranslationEnabled;
    const currentPrecedingContextLines = precedingContextLines;
    const currentSucceedingContextLines = succeedingContextLines;
    const allEntriesSnapshot = [...srtEntries]; // Snapshot of all original entries

    for (const entry of initialProcessingEntries) { // Iterate over the prepared list
      if (controller.signal.aborted) {
        console.log('Translation aborted by user.');
        break;
      }
      setCurrentTranslationId(entry.id);
      const processedEntry = await translateSingleEntry(
        entry, 
        controller.signal, 
        currentApiSettings, 
        currentSourceLang, 
        currentTargetLang,
        currentAutoRetryEnabled,
        currentContextualTranslationEnabled,
        currentPrecedingContextLines,
        currentSucceedingContextLines,
        allEntriesSnapshot
      );
      setTranslatedSrtEntries(prevEntries => 
        prevEntries.map(pe => pe.id === processedEntry.id ? processedEntry : pe)
      );
    }
    setIsTranslating(false);
    setCurrentTranslationId(null);
    setAbortController(null);
  };

  const retryFailedEntries = async () => {
    const entriesToRetryOriginal = translatedSrtEntries.filter(entry => !!entry.error);
    if (entriesToRetryOriginal.length === 0) {
      alert('No failed entries to retry.');
      return;
    }

    console.log('Retrying entries:', entriesToRetryOriginal.map(e => e.id));
    setIsTranslating(true);
    const controller = new AbortController();
    setAbortController(controller);

    // Snapshot current settings for the retry batch
    const currentApiSettings = { ...apiSettings };
    const currentSourceLang = sourceLanguage;
    const currentTargetLang = targetLanguage;
    const currentAutoRetryEnabled = autoRetryEnabled; 
    const currentContextualTranslationEnabled = contextualTranslationEnabled;
    const currentPrecedingContextLines = precedingContextLines;
    const currentSucceedingContextLines = succeedingContextLines;
    const allEntriesSnapshot = [...srtEntries]; // Snapshot of all original entries
    
    // Clear errors for entries that will be retried in the UI
    setTranslatedSrtEntries(prevEntries => 
        prevEntries.map(entry => 
            entriesToRetryOriginal.find(etr => etr.id === entry.id) 
            ? { ...entry, translatedText: '', error: undefined } 
            : entry
        )
    );
    
    for (const entryToRetry of entriesToRetryOriginal) { // Iterate over the original list of failed entries
      if (controller.signal.aborted) {
        console.log('Retry aborted by user.');
        break;
      }
      setCurrentTranslationId(entryToRetry.id);
      // We pass the original entryToRetry (which has .text) to translateSingleEntry
      const processedEntry = await translateSingleEntry(
        entryToRetry, 
        controller.signal, 
        currentApiSettings, 
        currentSourceLang, 
        currentTargetLang,
        currentAutoRetryEnabled,
        currentContextualTranslationEnabled,
        currentPrecedingContextLines,
        currentSucceedingContextLines,
        allEntriesSnapshot
      );
      setTranslatedSrtEntries(prevEntries => 
        prevEntries.map(pe => pe.id === processedEntry.id ? processedEntry : pe)
      );
    }

    setIsTranslating(false);
    setCurrentTranslationId(null);
    setAbortController(null);
  };

  const stopTranslation = () => {
    if (abortController) {
      abortController.abort();
      setIsTranslating(false);
      setCurrentTranslationId(null);
      console.log('Stop translation signal sent.');
    }
  };

  const exportSrt = () => {
    if (!translatedSrtEntries.length) {
      alert('No translated subtitles to export.');
      return;
    }
    const srtContent = translatedSrtEntries.map(entry => {
      return `${entry.id}\n${entry.startTime.replace('.', ',')} --> ${entry.endTime.replace('.', ',')}\n${entry.translatedText || entry.text}\n`;
    }).join('\n');

    const blob = new Blob([srtContent], { type: 'text/srt;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'translated_subtitles.srt');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div ref={mainContainerRef} className="min-h-screen body-gradient-background flex flex-col items-center text-[#8785a2] font-pixelated">
      <header className="w-full py-4 px-8 bg-[#f6f6f6]/80 backdrop-blur-md shadow-sm fixed top-0 z-50 rounded-b-full">
        <nav className="container mx-auto flex justify-between items-center">
          <motion.div
            className="text-2xl font-bold text-[#8785a2] app-header-title" // Added class for GSAP
          >
            SRT AI Translator
          </motion.div>
        </nav>
      </header>

      <main ref={appContentRef} className="container mx-auto mt-24 p-8 flex-grow w-full max-w-4xl">
        <motion.div
          // initial={{ opacity: 0, y: 50 }} // GSAP will handle entrance, or keep for initial hidden state
          // animate={{ opacity: 1, y: 0 }}
          // transition={{ duration: 0.7, delay: 0.3, ease: "circOut" }}
          className="bg-white p-6 md:p-8 rounded-lg shadow-xl"
        >
          <div ref={uploadSectionRef}> {/* Ref for GSAP entrance */}
            <motion.h1 
              className="text-3xl md:text-4xl font-bold text-[#8785a2] mb-6 text-center app-main-title"
              // initial={{ opacity: 0, y: -20 }} // GSAP can handle this if preferred
              // animate={{ opacity: 1, y: 0 }}
              // transition={{ duration: 0.5, delay: 0.5 }}
            >
            Upload Your SRT File for Translation
            </motion.h1>
          
            <motion.div
              // initial={{ opacity: 0, scale: 0.95 }}
              // animate={{ opacity: 1, scale: 1 }}
              // transition={{ duration: 0.5, delay: 0.6 }}
            >
          <SrtUpload onSrtParsed={handleSrtParsed} />
            </motion.div>
          </div>

          <div ref={settingsSectionRef} className="my-8"> {/* Ref for GSAP entrance and ScrollTrigger */}
            <div 
              className="flex justify-between items-center cursor-pointer mb-4" 
              onClick={toggleSettings}
            >
              <h2 className="text-2xl font-semibold text-[#8785a2]">Translation Settings</h2>
              <motion.div whileHover={{ scale: 1.1 }}> 
                <svg ref={settingsToggleIconRef} className={'w-6 h-6 text-[#8785a2]'} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </motion.div>
            </div>
            <AnimatePresence>
              {showSettings && (
                <motion.div
                  ref={settingsPanelRef} // Ref for potential GSAP/Anime.js animations
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginTop: '1rem' }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  transition={{ duration: 0.4, ease: 'easeInOut' }}
                  className="" // Temporarily remove overflow-hidden
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 form-element-group">
                    <div>
                      <label htmlFor="baseUrl" className="block text-sm font-medium text-[#8785a2] mb-1">API Base URL:</label>
                      <input type="text" name="baseUrl" id="baseUrl" value={apiSettings.baseUrl} onChange={handleApiSettingChange} className="w-full p-2 border border-[#8785a2] rounded-md shadow-sm focus:ring-[#8785a2] focus:border-[#8785a2]" />
                    </div>
                    <div>
                      <label htmlFor="apiKey" className="block text-sm font-medium text-[#8785a2] mb-1">API Key:</label>
                      <input type="password" name="apiKey" id="apiKey" value={apiSettings.apiKey} onChange={handleApiSettingChange} className="w-full p-2 border border-[#8785a2] rounded-md shadow-sm focus:ring-[#8785a2] focus:border-[#8785a2]" />
                    </div>
                  </div>
                  <div className="mb-4 form-element-group">
                      <label htmlFor="modelName" className="block text-sm font-medium text-[#8785a2] mb-1">Model Name:</label>
                      <input type="text" name="modelName" id="modelName" value={apiSettings.modelName} onChange={handleApiSettingChange} className="w-full p-2 border border-[#8785a2] rounded-md shadow-sm focus:ring-[#8785a2] focus:border-[#8785a2]" placeholder="e.g., gpt-3.5-turbo" />
                  </div>
                  <div className="form-element-group">
                    <label htmlFor="systemPrompt" className="block text-sm font-medium text-[#8785a2] mb-1">System Prompt:</label>
                    <textarea name="systemPrompt" id="systemPrompt" value={apiSettings.systemPrompt} onChange={handleApiSettingChange} rows={3} className="w-full p-2 border border-[#8785a2] rounded-md shadow-sm focus:ring-[#8785a2] focus:border-[#8785a2]"></textarea>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4 form-element-group">
              <div>
                      <label htmlFor="sourceLanguage" className="block text-sm font-medium text-[#8785a2] mb-1">Source Language:</label>
                      <select id="sourceLanguage" name="sourceLanguage" value={sourceLanguage} onChange={handleLanguageChange(setSourceLanguage)} className="w-full p-2 border border-[#8785a2] rounded-md shadow-sm focus:ring-[#8785a2] focus:border-[#8785a2]">
                        {languageOptions.map(lang => <option key={lang.value} value={lang.value}>{lang.label}</option>)}
                      </select>
              </div>
              <div>
                      <label htmlFor="targetLanguage" className="block text-sm font-medium text-[#8785a2] mb-1">Target Language:</label>
                      <select id="targetLanguage" name="targetLanguage" value={targetLanguage} onChange={handleLanguageChange(setTargetLanguage)} className="w-full p-2 border border-[#8785a2] rounded-md shadow-sm focus:ring-[#8785a2] focus:border-[#8785a2]">
                        {languageOptions.filter(lang => lang.value !== 'auto').map(lang => <option key={lang.value} value={lang.value}>{lang.label}</option>)}
                      </select>
              </div>
            </div>

                  {/* Auto-retry toggle */}
                  <div className="flex items-center space-x-2 mb-4 form-element-group">
                    <input
                      type="checkbox"
                      id="autoRetryToggle"
                      name="autoRetryToggle"
                      checked={autoRetryEnabled}
                      onChange={(e) => setAutoRetryEnabled(e.target.checked)}
                      className="h-4 w-4 text-[#8785a2] border-[#8785a2] rounded focus:ring-[#8785a2] cursor-pointer"
                    />
                    <label htmlFor="autoRetryToggle" className="text-sm font-medium text-[#8785a2] cursor-pointer">
                      Enable Automatic Retries (for retryable errors)
                    </label>
                  </div>

                  {/* Contextual Translation Settings */}
                  <div className="mb-4 form-element-group">
                    <div className="flex items-center space-x-2 mb-2">
                      <input
                        type="checkbox"
                        id="contextualTranslationToggle"
                        name="contextualTranslationToggle"
                        checked={contextualTranslationEnabled}
                        onChange={(e) => setContextualTranslationEnabled(e.target.checked)}
                        className="h-4 w-4 text-[#8785a2] border-[#8785a2] rounded focus:ring-[#8785a2] cursor-pointer"
                      />
                      <label htmlFor="contextualTranslationToggle" className="text-sm font-medium text-[#8785a2] cursor-pointer">
                        Enable Contextual Translation
                      </label>
                    </div>
                    {contextualTranslationEnabled && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0, marginTop: 0}}
                        animate={{ opacity: 1, height: 'auto', marginTop: '0.5rem' }}
                        exit={{ opacity: 0, height: 0, marginTop: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6"
                      >
                        <div>
                          <label htmlFor="precedingContextLines" className="block text-xs font-medium text-[#8785a2] mb-1">Preceding Lines:</label>
                          <input 
                            type="number"
                            id="precedingContextLines"
                            name="precedingContextLines"
                            value={precedingContextLines}
                            onChange={(e) => setPrecedingContextLines(Math.max(0, parseInt(e.target.value, 10) || 0))}
                            min="0"
                            max="5" // Arbitrary max, can be adjusted
                            className="w-full p-2 text-sm border border-[#8785a2] rounded-md shadow-sm focus:ring-[#8785a2] focus:border-[#8785a2]"
                          />
            </div>
            <div>
                          <label htmlFor="succeedingContextLines" className="block text-xs font-medium text-[#8785a2] mb-1">Succeeding Lines:</label>
                          <input 
                            type="number"
                            id="succeedingContextLines"
                            name="succeedingContextLines"
                            value={succeedingContextLines}
                            onChange={(e) => setSucceedingContextLines(Math.max(0, parseInt(e.target.value, 10) || 0))}
                            min="0"
                            max="5" // Arbitrary max, can be adjusted
                            className="w-full p-2 text-sm border border-[#8785a2] rounded-md shadow-sm focus:ring-[#8785a2] focus:border-[#8785a2]"
                          />
                        </div>
                      </motion.div>
                    )}
                  </div>

                  <div className="my-4 form-element-group">
                    <motion.button
                      ref={testConnectivityButtonRef}
                      onClick={testConnectivity}
                      disabled={connectivityStatus === 'testing'}
                      className="w-full bg-[#ffe2e2] hover:bg-[#ffc7c7] text-[#8785a2] font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-lg hover:shadow-[#ffc7c7]/50 transform hover:-translate-y-0.5"
                      whileHover={{ scale: 1.03, boxShadow: "0px 5px 15px rgba(255, 199, 199, 0.4)" }}
                      whileTap={{ scale: 0.97, boxShadow: "0px 2px 8px rgba(255, 199, 199, 0.3)" }}
                      transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    >
                      <span ref={testConnectivityButtonTextRef} className="inline-block">
                        {connectivityStatus === 'testing' ? 'Testing...' : 'Test AI Provider Connectivity'}
                      </span>
                    </motion.button>
                    {connectivityStatus === 'success' && <p className="text-[#8785a2] text-sm mt-1">Connectivity test successful!</p>}
                    {connectivityStatus === 'error' && <p className="text-[#8785a2] text-sm mt-1">Connectivity test failed. Please check API settings and network.</p>}
            </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <motion.button
            ref={startTranslationButtonRef} // Assign the specific ref for this button
            onClick={startTranslation}
            disabled={isTranslating || !srtEntries.length}
            className="w-full bg-[#8785a2] hover:bg-[#6f6d87] text-[#f6f6f6] font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-lg hover:shadow-[#8785a2]/50 transform hover:-translate-y-0.5"
            whileHover={{ scale: 1.03, boxShadow: "0px 5px 15px rgba(135, 133, 162, 0.4)" }}
            whileTap={{ scale: 0.97, boxShadow: "0px 2px 8px rgba(135, 133, 162, 0.3)" }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            {/* Wrap text in a span for GSAP manipulation */}
            <span ref={startTranslationButtonTextRef} className="inline-block">
            {isTranslating ? (
              <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-[#f6f6f6] inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Translating... {currentTranslationId !== null ? `(Entry ${currentTranslationId})` : ''}
              </>
            ) : 'Start Translation'}
            </span>
          </motion.button>

          {srtEntries.length > 0 && (
            <div ref={outputSectionRef} className="my-8"> {/* Ref for GSAP entrance and ScrollTrigger */}
              <h2 className="text-2xl font-semibold text-[#8785a2] mb-4">Translation Progress & Output</h2>
              <div className="flex justify-between items-center mb-2 flex-wrap gap-2"> {/* Added flex-wrap and gap for responsiveness */}
                <motion.button
                  onClick={stopTranslation}
                  disabled={!isTranslating}
                  className="bg-[#ffc7c7] hover:bg-[#f5b0b0] text-[#8785a2] font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow hover:shadow-[#ffc7c7]/50 transform hover:-translate-y-0.5"
                  whileHover={{ scale: 1.05, boxShadow: "0px 3px 10px rgba(255, 199, 199, 0.4)" }}
                  whileTap={{ scale: 0.95, boxShadow: "0px 1px 5px rgba(255, 199, 199, 0.3)" }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  Stop Translation
                </motion.button>

                {/* New "Retry Failed Entries" Button */}
                <motion.button
                  onClick={retryFailedEntries}
                  disabled={isTranslating || !translatedSrtEntries.some(e => e.error)}
                  className="bg-[#ffe2e2] hover:bg-[#ffc7c7] text-[#8785a2] font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow hover:shadow-[#ffc7c7]/50 transform hover:-translate-y-0.5"
                  whileHover={{ scale: 1.05, boxShadow: "0px 3px 10px rgba(255, 199, 199, 0.4)" }}
                  whileTap={{ scale: 0.95, boxShadow: "0px 1px 5px rgba(255, 199, 199, 0.3)" }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  Retry Failed Entries
                </motion.button>

                <motion.button
                  onClick={exportSrt}
                  disabled={isTranslating || !translatedSrtEntries.some(e => e.translatedText)}
                  className="bg-[#ffe2e2] hover:bg-[#ffc7c7] text-[#8785a2] font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow hover:shadow-[#ffc7c7]/50 transform hover:-translate-y-0.5"
                  whileHover={{ scale: 1.05, boxShadow: "0px 3px 10px rgba(255, 199, 199, 0.4)" }}
                  whileTap={{ scale: 0.95, boxShadow: "0px 1px 5px rgba(255, 199, 199, 0.3)" }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  Export Translated Subtitles (.srt)
                </motion.button>
              </div>
              <div className="space-y-4 max-h-[500px] overflow-y-auto p-4 bg-[#f6f6f6] rounded-md border border-[#8785a2]/50">
                {translatedSrtEntries.map((entry) => (
                  <motion.div 
                    key={entry.id} 
                    layout 
                    className={`p-3 rounded-md shadow translation-item-gsap ${currentTranslationId === entry.id && isTranslating ? 'bg-[#ffe2e2] ring-2 ring-[#8785a2]' : 'bg-white'}`}
                  >
                    <div className="text-xs text-[#8785a2] mb-1">
                      ID: {entry.id} | Time: {entry.startTime} --&gt; {entry.endTime}
                    </div>
                    <p className="text-sm text-[#8785a2] mb-1 whitespace-pre-wrap">Original: {entry.text}</p>
                    
                    {entry.error ? (
                      <div className="text-sm whitespace-pre-wrap font-semibold text-[#c57575]">
                        <p className="font-bold">翻译错误:</p>
                        <p>类型: {entry.error.type} {entry.error.code ? `(Code: ${entry.error.code})` : ''}</p>
                        <p>信息: {entry.error.message}</p>
                        {entry.error.retryable && <p className="text-xs">(此错误稍后或许可以重试)</p>}
                      </div>
                    ) : entry.translatedText ? (
                      <p className="text-sm whitespace-pre-wrap font-semibold text-[#8785a2]">
                        Translation: {entry.translatedText}
                      </p>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap font-semibold text-[#8785a2]">
                        {isTranslating && currentTranslationId === entry.id ? 'Translating...' : 'Pending...'}
                    </p>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </main>

      <footer className="w-full py-6 text-center text-[#8785a2] text-sm">
        <p>&copy; 2025 SRT AI Translator. Inspired by aitls.emotion-agency.com</p>
      </footer>
    </div>
  );
}

export default App;

