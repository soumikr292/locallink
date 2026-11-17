import sys
import json
import wave
import struct
import speech_recognition as sr

def transcribe(wav_path, lang="bn-IN"):
    r = sr.Recognizer()
    try:
        with sr.AudioFile(wav_path) as source:
            # Adjust for ambient noise and record
            audio = r.record(source)
        text = r.recognize_google(audio, language=lang)
        return {"success": True, "transcript": text, "lang": lang}
    except sr.UnknownValueError:
        return {"success": False, "error": "no-speech", "message": "No speech detected in audio"}
    except sr.RequestError as e:
        return {"success": False, "error": "api-error", "message": str(e)}
    except Exception as e:
        return {"success": False, "error": "unknown", "message": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "missing-args"}))
        sys.exit(1)
    
    wav_file = sys.argv[1]
    language = sys.argv[2] if len(sys.argv) > 2 else "bn-IN"
    result = transcribe(wav_file, language)
    print(json.dumps(result))
