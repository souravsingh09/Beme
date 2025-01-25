from flask import Flask, render_template, Response, request, redirect, session, url_for,jsonify
import cv2
from flask_bootstrap import Bootstrap5
from datetime import datetime
import whisper
from wordcloud import WordCloud
import re
from pysentimiento import create_analyzer
from itertools import chain
import librosa
import matplotlib
import matplotlib.pyplot as plt
matplotlib.use('Agg')
import wave
import numpy as np
from scipy.interpolate import interp1d
import crepe
from scipy.io import wavfile
import os
import soundfile as sf
from collections import Counter
import globalvar
import html
from bs4 import BeautifulSoup
from werkzeug.middleware.dispatcher import DispatcherMiddleware
from werkzeug.exceptions import NotFound

app = Flask(__name__, template_folder='templates')
app.secret_key = 'login'

################################ Transcript generation. ################################################################################
model = whisper.load_model("base")
analyzer = create_analyzer(task="sentiment", lang="en")

##################################### session check box function ######################################################################
def is_checkbox_checked():
    return session.get('checkbox_checked', False)

###################################### Create a function to find and highlight words ##################################### 
def highlight_words(inclusive_word, transcript):

    # Split the transcript into words
    words = transcript.split()

    matched_phrases = [] 
    # Initialize a list to keep track of matched indices
    matched_indices = [False] * len(words)

    for key, replacements in inclusive_word.items():
        key_words = key.split()  # Split the key into words

        # Find and mark the matching words in the transcript
        for i in range(len(words) - len(key_words) + 1):
            if all(words[i + j].lower() == key_words[j] for j in range(len(key_words))):
                # Mark the matched words
                for j in range(len(key_words)):
                    matched_indices[i + j] = True

                # Create the highlighted span
                highlighted = ' '.join(words[i:i + len(key_words)])
                highlighted = f'<span class="highlighted" title="Suggested: {", ".join(replacements)}">{highlighted}</span>'
                words[i:i + len(key_words)] = [highlighted]
                matched_phrases.append(highlighted)

    # Reconstruct the transcript with highlighted words
    highlighted_transcript = ' '.join(words)
    session['matched_phrases'] = matched_phrases
	
	
    return highlighted_transcript

########################## AUDIO TRANSCRIPTION AND ANALYSIS #############################################################################
def audioTrans(path):

    ###################### Model used for converting audio into text ####################################################################
    result = model.transcribe(path, fp16=False)
    transcript = result["text"]
 
   ############################# for identifying the filler word in transcript #####################################################
    txt = result["text"].lower()
    txt = re.sub(' \s+',' ', txt)
    
    fillers= []
    for i in globalvar.filler_words:
        matches = re.findall(' {}'.format(i.lower()), txt.lower())
        if matches:
            fillers.append(matches)
    count_filler_word = list(chain(*fillers))
    var_count_filler_word  = len(count_filler_word)

    ############################# identifying the most used words in the transcript #####################################################
    rslt = WordCloud().process_text(txt).items()
    rslt = list(rslt)
    rslt = sorted(rslt, key=lambda tup: (-tup[1]) )
    rslt = rslt[:10]
    ############################# identifying the sentiment from the transcript ##########################################
    words = txt.split()
    text_sentiment    = analyzer.predict(txt)
    text_sentiment    = text_sentiment.probas
    text_sentiment    = max(text_sentiment, key=text_sentiment.get)
	
    if text_sentiment == 'NEG':
        text_sentiment = "NEGATIVE"
    elif text_sentiment == 'NEU':
        text_sentiment = "NEUTRAL"
    else:
        text_sentiment = "POSITIVE"

    ############################# identifying the various data from the transcript #######################################
    total_words       = len(words)
    total_unq_words   = len(set(words))
    video_len = librosa.get_duration(filename=path)
    avg_speaking_rate = len(words) / (video_len / 60)
    avg_speaking_rate = "{:.2f}".format(avg_speaking_rate)
    ############################# to get the time in minutes ######################################################
    video_len = (video_len/60)
    video_len = "{:.2f}".format(video_len)
    # Call the function to get the highlighted transcript
    transcript = re.sub(r"\.", " .", transcript, 0, re.MULTILINE)
    transcript = highlight_words(globalvar.inclusive_word, transcript)
    # Parse the unescaped HTML string
    # transcript = BeautifulSoup(transcript, 'html.parser')
    session['transcript']= transcript
    session['rslt']                  = rslt
    session['total_words']           = total_words
    session['total_unq_words']       = total_unq_words
    session['avg_speaking_rate']     = avg_speaking_rate
    session['var_count_filler_word'] = var_count_filler_word
    session['video_len']             = video_len
    session['text_sentiment']        = text_sentiment
	

   
################################ waveGraph for amplitude vs time ########################################################################
def waveGraph(path):
    filename = session['filename']
    print('====================================',filename)
    
    ################## Open wav file and read frames as bytes #################
    sf_filewave = wave.open(path, 'r')
    signal_sf = sf_filewave.readframes(-1)
    ################## Convert audio bytes to integers #################
    soundwave_sf = np.frombuffer(signal_sf, dtype='int16')
    ###################### Get the sound wave frame rate ###############
    framerate_sf = sf_filewave.getframerate()
    ###################### Find the sound wave timestamps ###############
    time_sf = np.linspace(start=0,
                        stop=len(soundwave_sf)/framerate_sf,
                        num=len(soundwave_sf))    
    ###################### Set up plot ###########################
    fig01, ax = plt.subplots(figsize=(15, 6))
    ############# Setup the title and axis titles ############
    plt.ylabel('Amplitude')
    plt.xlabel('Time (seconds)')
    ############# Add the audio data to the plot ############
    fig01 = plt.plot(time_sf, soundwave_sf, label='Warm Memories', alpha=0.5)
    wave_plt_path = 'static/img/wave_{}.jpg'.format(filename)
    session['wave_plt_path'] = wave_plt_path
    plt.savefig(wave_plt_path)

################################ pitch graph ############################################################################################
def pitchGraph(path):
    global pitch_plt_path
    filename = session['filename']
    # Load the audio file
    sr, audio = wavfile.read(path)
    # Extract the pitch information
    time, frequency, confidence, activation = crepe.predict(audio, sr, viterbi=True)
    # Downsample the data for visualization
    time = np.array(time[::100])
    frequency = np.array(frequency[::100])
    # Interpolate to obtain a smooth curve
    xnew = np.linspace(time.min(), time.max(), 500)
    spl = interp1d(time, frequency, kind="cubic")
    y_smooth = spl(xnew)
    # Set the figure size
    fig = plt.figure(figsize=(15, 6))
    # Create a smooth line chart
    plt.plot(xnew, y_smooth)
    plt.xlabel('Time (s)')
    plt.ylabel('Pitch (Hz)')
    # Calculate the average pitch value
    average_pitch = np.mean(y_smooth)
    # Draw a horizontal line at the average pitch level
    plt.axhline(y=average_pitch, color='r', linestyle='--', label='Medium Line')
    pitch_plt_path = 'static/img/pitch_{}.jpg'.format(filename)
    plt.savefig(pitch_plt_path)

##################################### Landing Page URL ###########################################################################
@app.route('/',methods=['GET', 'POST'])
def home_page(): 
    session.pop('checkbox_checked', None) 
    if request.method == 'POST':
        checkbox_value = request.form.get('policyAccepted')
        if checkbox_value:
            session['checkbox_checked'] = True
            return redirect(url_for('camera')) 
        else:
            session.pop('checkbox_checked', None)
    else:
        return render_template('index.html')

##################################### VIDEO RECORDING URL ###########################################################################
@app.route('/camera',methods=['GET','POST'])
def camera(): 
    if is_checkbox_checked():
        return render_template("camera.html")
    else:
        return redirect(url_for('home_page'))

##################################### Upload Audio on server ###########################################################################   
@app.route('/upload_audio', methods=['POST','GET'])
def upload_audio():
    
    filename = str(datetime.now())
    filename = filename.split()[-1].replace(':','.')
    session['filename'] = filename
    path = './files/{}.wav'.format(filename)
    f = request.files['audio']
    with open(path, "wb") as aud:
        aud_stream = f.read()
        aud.write(aud_stream)

    video_emotion_lst = []
    video_emotion_lst = request.form.get('dominantExpressions')
    video_emotion_lst = eval(video_emotion_lst)
    video_emotion_lst = [ 'negative' if item in ['disgusted','sad','fearful','angry'] else 'positive' if item in ['happy','surprised'] else 'neutral' for item in video_emotion_lst ]
    consolidated_emotion = Counter(video_emotion_lst)
    dictionary = dict(consolidated_emotion)
    x_video = list(dictionary.keys())
    y_video = list(dictionary.values())

    face_emot_color =[]
    for j in range(len(x_video)):
        if x_video[j] == 'negative':
            face_emot_color.append('#ff6384')
        elif x_video[j] == 'neutral':
            face_emot_color.append('#0dcaf0')
        else:
            face_emot_color.append('#20c997')

    dictionary = [x_video, y_video,face_emot_color,'']
	
	########## SESSION OBJECT ############
    session['dictionary']  = dictionary

    y, sr = librosa.load(path)
    sf.write(path, y, 22050)

    audioTrans(path)
    waveGraph(path)
    #pitchGraph(path)
    print('============Wave processed==============')
    f.close()
    #checking if AUDIO PATH file exist or not
    if(os.path.isfile(path)):
        ##########function to remove the audio file ##################
        os.remove(path)

    try:
        print('================i am in try')
        print(session.get('transcript'), type(session.get('transcript')))
        print(session.get('rslt'), type(session.get('rslt')))
        print(session.get('total_words'), type(session.get('total_words')))
        print(session.get('total_unq_words'), type(session.get('total_unq_words')))
        print(session.get('avg_speaking_rate'), type(session.get('avg_speaking_rate')))
        print(session.get('var_count_filler_word'), type(session.get('var_count_filler_word')))
        print(session.get('video_len'), type(session.get('video_len')))
        print(session.get('text_sentiment'), type(session.get('text_sentiment')))
        print(session.get('wave_plt_path'), type(session.get('wave_plt_path')))
        print(session.get('matched_phrases'), type(session.get('matched_phrases')))
        print('+++++++++++++++++++++++++++++++++++++++++++++++++++++++')

        return redirect(url_for('report'))
    except Exception as e:
        print('=========== i am in catch')
        return f"An error occurred: {str(e)}"
    
##################################### REPORT URL ###########################################################################
@app.route('/report',methods=['GET','POST'])
def report():
    if is_checkbox_checked():
        print('==============in report sec====')
        dictionary                = session['dictionary']
        transcript                = session.get('transcript')
        rslt                      = session.get('rslt')
        total_words               = session.get('total_words')
        total_unq_words           = session.get('total_unq_words')
        avg_speaking_rate         = session.get('avg_speaking_rate')
        var_count_filler_word     = session.get('var_count_filler_word')
        video_len                 = session.get('video_len')
        text_sentiment            = session.get('text_sentiment')
        wave_plt_path             = session.get('wave_plt_path')
        matched_phrases           = session.get('matched_phrases')

        return render_template("charts.html",video_data=dictionary, 
                                transcript_data=transcript,
                                repetitive_word=rslt,
                                total_word_len=total_words,
                                unique_word_len=total_unq_words,  
                                speaking_rate=avg_speaking_rate,
                                filler_words=var_count_filler_word,
                                video_length=video_len, 
                                text_sentiment_data=text_sentiment,
                                wave_image_path=wave_plt_path,
                                inclusive_word_count = len(matched_phrases))
    else:
        return redirect('/')
    
##################################### Recommendation URL ###########################################################################
@app.route('/recommendation')
def new_page():
    if is_checkbox_checked():
        return render_template('/recommendation.html')
    else:
        return redirect('/')

##################################### delete image URL ###########################################################################
@app.route('/delete_file', methods=['POST'])
def delete_file():
    print('++++++++++++++++++++++++++++++++++++++++',request.json['file_paths'])
    file_path = request.json['file_paths']
    for file_name in file_path:
        if os.path.exists(file_name):
            os.remove(file_name)
    # return jsonify({'redirectTo': '/'})
    return redirect('/')


##################### Runnin the server ###########################    
hostedApp = Flask(__name__)
hostedApp.wsgi_app = DispatcherMiddleware(
    NotFound(),
    {'/beme': app.wsgi_app}
)

############### run the server #####################
hostedApp.run(host="0.0.0.0",port= 8001,debug=True,use_reloader=True)


