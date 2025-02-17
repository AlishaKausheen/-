"use client"


import React, { useEffect, useState } from 'react'
import { db } from '../../../../../utils/db';
import { MockInterview, UserAnswer } from '../../../../../utils/schema';
import { eq } from 'drizzle-orm';
import { Lightbulb, Mic, Pause, Volume2 } from 'lucide-react';
import Webcam from 'react-webcam';
import Image from 'next/image';
import { Button } from '../../../../../components/button';
import useSpeechToText from 'react-hook-speech-to-text';
import { toast } from 'sonner';
import { chatSession } from '../../../../../utils/GeminiAIModal';
import { useUser } from '@clerk/nextjs';
import moment from 'moment';
import Link from 'next/link';


//import {QuestionsSection} from "./_components/QuestionsSection"
//import {QuestionsSection} from './_components/QuestionsSection'
function StartInterview({params}) {

  const [interviewData,setInterviewData] = useState();
  const [mockInterviewQuestion, setMockInterviewQuestion] = useState([]);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(false);
  const {user} = useUser();
  useEffect(()=>{

    GetInterviewDetails();
  },[])

  useEffect(()=>{
if(!isRecording && userAnswer.length>10){
  UpdateUserAnswer();
}
  },[userAnswer])
  // used to get interview by mockid/interviewid
  const GetInterviewDetails=async ()=>{
    const result = await db.select().from(MockInterview).where(eq(MockInterview.mockId,params.interviewId));

const jsonMockResp = JSON.parse(result[0].jsonMockResp);
console.log(jsonMockResp);
setMockInterviewQuestion(jsonMockResp);
setInterviewData(result[0]);

}


const {
  error,
  interimResult,
  isRecording,
  results,
  startSpeechToText,
  stopSpeechToText,
  setResults,
} = useSpeechToText({
  continuous: true,
  useLegacyResults: false
});

const textToSpeech=(text)=>{
  if('speechSynthesis' in window){
    const speech =new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(speech);
  }else{
    alert('Sorry, your browser doesnot support text to speech')
  }
}
useEffect(()=>{
results.map((result)=>(
  setUserAnswer(prevAns=> prevAns+result?.transcript)
))
},[results])
 
const StartStopRecording = async ()=>{
  if(isRecording){
  
stopSpeechToText();

  }else{
startSpeechToText();
  }

}

const UpdateUserAnswer = async ()=>{
  console.log(userAnswer);
  setLoading(true);
  const feedbackPrompt ="Question: "+mockInterviewQuestion[activeQuestionIndex]?.question+", User Answer"+ userAnswer+", Depends on question and user answer for given interview question"+
  " please give us rating for answer and feedback as area of improvement if any in just 3-5 lines to improve it in JSON format with rating field and feedback field"
  
  const result = await chatSession.sendMessage(feedbackPrompt);

  const mockJsonResp = (result.response.text()).replace('```json', '').replace('```','');
  console.log(mockJsonResp);
  const JsonFeedbackResp= JSON.parse(mockJsonResp);
  
  const resp= await db.insert(UserAnswer)
  .values({
    mockIdRef: interviewData?.mockId,
    question: mockInterviewQuestion[activeQuestionIndex]?.question,
    correctAns: mockInterviewQuestion[activeQuestionIndex]?.answer,
    userAns: userAnswer,
    feedback: JsonFeedbackResp?.feedback,
    rating: JsonFeedbackResp?.rating,
    userEmail: user?.primaryEmailAddress?.emailAddress,
    createdAt: moment().format('DD-MM-YYYY')
  })
  if(resp){
    toast('User Answer recorded successfully');
    setUserAnswer('');
    setResults([]);
  }
  setResults([]);
  //setUserAnswer('');
  setLoading(false);
}
return (
    <div>
      <div className='grid grid-cols-1 md:grid-cols-2 gap-1'>
        
{/*questions */}
<div className='p-5 border rounded-lg my-5'>
  <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5'>
  {mockInterviewQuestion && mockInterviewQuestion.map((question,index)=>(
    <h2  key={index}
    onClick={() => setActiveQuestionIndex(index)} className={`p-2 bg-secondary rounded-full text-xs md:text-sm text-center cursor-pointer ${activeQuestionIndex==index&&'bg-blue-800 text-white'}`}>Question #{index+1}</h2>
  ))}
  </div>  

  <h2 className='my-5 text-md md:text-lg'>
  {mockInterviewQuestion.length > 0 
    ? mockInterviewQuestion[activeQuestionIndex]?.question 
    : "Loading questions..."}
</h2>
<Volume2 className='cursor-pointer' onClick={()=> textToSpeech(mockInterviewQuestion[activeQuestionIndex]?.question)}/>
{showAnswer && (
        <div className="mt-2 p-2 bg-gray-200 rounded">
        Answer:  {userAnswer || 'No answer provided.'}
        </div>
      )}
  <div className='border rounded-lg p-5 bg-blue-100 mt-20'>
    <h2 className='flex gap-2 items-center text-primary'>
      <Lightbulb/>
      <strong>Note:</strong>
    </h2>
    <h2 className='text-sm text-primary my-2'>{process.env.NEXT_PUBLIC_INFORMATION}</h2>
  </div>
  </div> 
  {/* audio and video recording */}
  <div className='flex items-center justify-center flex-col'>
      <div className='flex flex-col mt-20 justify-center items-center bg-black  rounded-lg p-5'>
  
    <Webcam
    mirrored={true}
    style={{
      height:300,
      width:'100%',
      zIndex:10,
    }}
    />
    </div>
<Button disable={loading} variant='outline' className={`my-10 border ${isRecording ? 'border-red-600' : 'border-blue-800'}`}
onClick={StartStopRecording}>
  {isRecording? <h2 className='text-red-600 flex gap-2'><Pause/>Stop Recording</h2>:<h2 className='text-blue-800  flex gap-2'><Mic/>Record Answer</h2>}
  </Button>
{/*<Button onClick={() => setShowAnswer(!showAnswer)}>Show User Answer</Button>*/}
    </div>
      </div>
<div className=' flex justify-end gap-6 '>
 {activeQuestionIndex>0 && 
 <Button onClick={()=>setActiveQuestionIndex(activeQuestionIndex-1)}>Previous Question</Button>}
  {activeQuestionIndex!=mockInterviewQuestion?.length-1 && 
  <Button onClick={()=>setActiveQuestionIndex(activeQuestionIndex+1)}>Next Question</Button>}
  {activeQuestionIndex==mockInterviewQuestion?.length-1 && 
  <Link href={'/dashboard/interview/'+interviewData?.mockId+'/feedback'}><Button>End Interview </Button></Link>}

</div>

     
    </div>
  )
}

export default StartInterview
