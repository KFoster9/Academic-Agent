import React, { useState, useEffect } from 'react';
import { Calendar, Plus, X, Brain, Calculator, MessageSquare, Send } from 'lucide-react';

export default function AcademicAgent() {
  const [courses, setCourses] = useState([]);
  const [context, setContext] = useState({ schedule: '', syllabi: '' });
  const [recs, setRecs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('overview');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [uploadingSyllabus, setUploadingSyllabus] = useState(false);
  const chatContainerRef = React.useRef(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  useEffect(() => {
    if (chatContainerRef.current && shouldAutoScroll) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages, chatLoading]);

  const handleChatScroll = (e) => {
    const element = e.target;
    const isAtBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 50;
    setShouldAutoScroll(isAtBottom);
  };

  const handleSyllabusUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setUploadingSyllabus(true);
    
    try {
      const text = await file.text();
      
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          messages: [{
            role: 'user',
            content: 'Extract key information from this syllabus and format it for academic planning. Include: course name, instructor, email, office hours, grading breakdown, extra credit, attendance policy, late work policy, important dates, and any other strategic info. Format with clear headers and bullet points.\n\nSyllabus:\n' + text
          }]
        })
      });
      
      const data = await res.json();
      const extractedInfo = data.content[0].text;
      
      const currentSyllabi = context.syllabi || '';
      const separator = currentSyllabi ? '\n\n==========================================\n\n' : '';
      const updatedSyllabi = currentSyllabi + separator + extractedInfo;
      
      saveCtx({ ...context, syllabi: updatedSyllabi });
      alert('Syllabus uploaded and parsed successfully!');
    } catch (err) {
      console.error('Upload error:', err);
      alert('Error uploading syllabus. Please try again.');
    }
    
    setUploadingSyllabus(false);
    e.target.value = '';
  };

  useEffect(() => {
    const load = async () => {
      try {
        const c = await window.storage.get('courses');
        if (c && c.value) setCourses(JSON.parse(c.value));
        const ctx = await window.storage.get('context');
        if (ctx && ctx.value) setContext(JSON.parse(ctx.value));
        const msgs = await window.storage.get('chatHistory');
        if (msgs && msgs.value) setChatMessages(JSON.parse(msgs.value));
      } catch (err) {
        console.error('Load error:', err);
      }
    };
    load();
  }, []);

  const save = (c) => {
    setCourses(c);
    window.storage.set('courses', JSON.stringify(c)).catch(() => {});
  };

  const saveCtx = (c) => {
    setContext(c);
    window.storage.set('context', JSON.stringify(c)).catch(() => {});
  };

  const addCourse = (name, grade) => {
    save([...courses, { id: Date.now(), name, currentGrade: Number(grade) || 0, assignments: [] }]);
  };

  const addAssignment = (cid, name, date, weight) => {
    save(courses.map(c => c.id === cid ? { ...c, assignments: [...c.assignments, { id: Date.now(), name, dueDate: date, weight: Number(weight), status: 'not_started', score: null }] } : c));
  };

  const updateStatus = (cid, aid, status) => {
    save(courses.map(c => c.id === cid ? { ...c, assignments: c.assignments.map(a => a.id === aid ? { ...a, status } : a) } : c));
  };

  const updateScore = (cid, aid, score) => {
    save(courses.map(c => c.id === cid ? { ...c, assignments: c.assignments.map(a => a.id === aid ? { ...a, score: Number(score) } : a) } : c));
  };

  const deleteCourse = (id) => save(courses.filter(c => c.id !== id));
  
  const deleteAssignment = (cid, aid) => save(courses.map(c => c.id === cid ? { ...c, assignments: c.assignments.filter(a => a.id !== aid) } : c));

  const calcImpact = (course, assignment) => {
    const done = course.assignments.filter(a => a.status === 'completed' && a.score != null);
    
    let earnedPoints = 0;
    let totalCompletedWeight = 0;
    
    for (const a of done) {
      earnedPoints += a.score * (a.weight / 100);
      totalCompletedWeight += parseFloat(a.weight);
    }
    
    const currentGrade = totalCompletedWeight > 0 ? (earnedPoints / totalCompletedWeight) * 100 : 0;
    
    const calcNewGrade = (score) => {
      const newEarnedPoints = earnedPoints + (score * (assignment.weight / 100));
      const newTotalWeight = totalCompletedWeight + parseFloat(assignment.weight);
      return Math.round((newEarnedPoints / newTotalWeight) * 100 * 10) / 10;
    };
    
    return {
      current: Math.round(currentGrade * 10) / 10,
      if100: calcNewGrade(100),
      if90: calcNewGrade(90),
      if80: calcNewGrade(80),
      if70: calcNewGrade(70)
    };
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;
    
    const userMessage = { role: 'user', content: chatInput };
    const newMessages = [...chatMessages, userMessage];
    setChatMessages(newMessages);
    setChatInput('');
    setChatLoading(true);
    
    try {
      const today = new Date();
      const pending = courses.flatMap(c => c.assignments.filter(a => a.status !== 'completed').map(a => {
        const daysUntil = Math.ceil((new Date(a.dueDate) - today) / 864e5);
        return {
          id: a.id,
          courseId: c.id,
          course: c.name,
          name: a.name,
          due: a.dueDate,
          weight: a.weight,
          status: a.status,
          daysUntil: daysUntil
        };
      }));
      
      const completed = courses.flatMap(c => c.assignments.filter(a => a.status === 'completed').map(a => ({
        name: a.name,
        course: c.name,
        score: a.score,
        weight: a.weight
      })));
      
      const coursesData = JSON.stringify(courses.map(c => ({ name: c.name, assignmentCount: c.assignments.length })));
      const pendingData = JSON.stringify(pending.slice(0, 10));
      const completedData = JSON.stringify(completed.slice(0, 5));
      const scheduleData = context.schedule || '';
      const syllabiData = context.syllabi ? context.syllabi.substring(0, 1000) : '';
      const todayStr = today.toLocaleDateString();
      
      const systemPrompt = 'You are an empathetic academic advisor assistant. Today is ' + todayStr + '.\n\nSTUDENT DATA:\nCourses: ' + coursesData + '\nPending: ' + pendingData + '\nCompleted: ' + completedData + '\nSchedule: ' + scheduleData + '\nSyllabi: ' + syllabiData + '\n\nCAPABILITIES:\n- Answer questions about schedule, assignments, deadlines\n- Provide study advice\n- Offer emotional support\n- Help update assignment status\n\nACTIONS:\nWhen user reports completing work, respond with:\n[ACTION: UPDATE_ASSIGNMENT, courseName: "X", assignmentName: "Y", status: completed, score: Z]\n\nBe supportive and concise (2-3 paragraphs max).';

      const conversationHistory = newMessages.slice(-6).map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: systemPrompt,
          messages: conversationHistory
        })
      });
      
      const data = await res.json();
      const assistantMessage = data.content[0].text;
      
      const actionRegex = /\[ACTION: UPDATE_ASSIGNMENT, courseName: "([^"]+)", assignmentName: "([^"]+)", status: (\w+), score: (\d+)\]/;
      const actionMatch = assistantMessage.match(actionRegex);
      
      if (actionMatch) {
        const courseName = actionMatch[1];
        const assignmentName = actionMatch[2];
        const status = actionMatch[3];
        const score = actionMatch[4];
        const course = courses.find(c => c.name.toLowerCase().includes(courseName.toLowerCase()));
        if (course) {
          const assignment = course.assignments.find(a => a.name.toLowerCase().includes(assignmentName.toLowerCase()));
          if (assignment) {
            updateStatus(course.id, assignment.id, status);
            if (score) updateScore(course.id, assignment.id, score);
          }
        }
      }
      
      const cleanMessage = assistantMessage.replace(/\[ACTION:.*?\]/g, '').trim();
      const updatedMessages = [...newMessages, { role: 'assistant', content: cleanMessage }];
      setChatMessages(updatedMessages);
      window.storage.set('chatHistory', JSON.stringify(updatedMessages)).catch(() => {});
    } catch (e) {
      console.error(e);
      setChatMessages([...newMessages, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
    }
    
    setChatLoading(false);
  };

  const getRecs = async () => {
    setLoading(true);
    const today = new Date();
    const pending = courses.flatMap(c => c.assignments.filter(a => a.status !== 'completed').map(a => {
      const imp = calcImpact(c, a);
      const daysUntil = Math.ceil((new Date(a.dueDate) - today) / 864e5);
      return {
        course: c.name,
        name: a.name,
        due: a.dueDate,
        weight: a.weight,
        days: daysUntil,
        currentGrade: imp.current,
        if100: imp.if100,
        if90: imp.if90,
        if80: imp.if80,
        if70: imp.if70
      };
    }));

    if (!pending.length) {
      setRecs({ 
        top: 'All done!', 
        reason: 'No pending assignments', 
        gradeImpact: '',
        comparative: '',
        nextWeeks: '',
        today: '',
        schedule: '',
        office: '',
        extra: '',
        risks: [],
        leverage: '',
        workloadBalance: '',
        dependencies: '',
        semesterStrategy: '',
        cushionTracking: ''
      });
      setLoading(false);
      return;
    }

    try {
      const allAssignments = courses.flatMap(c => c.assignments);
      const totalAssignments = allAssignments.length;
      const completedCount = allAssignments.filter(a => a.status === 'completed').length;
      
      const scheduleText = context.schedule || 'No schedule provided';
      const syllabiText = context.syllabi ? context.syllabi.substring(0, 2000) : 'No syllabi provided';
      const pendingText = JSON.stringify(pending.slice(0, 15), null, 2);
      const todayStr = today.toLocaleDateString();
      
      const promptContent = 'You are an expert academic advisor. Today is ' + todayStr + '.\n\nSEMESTER OVERVIEW:\n- Total Assignments: ' + totalAssignments + '\n- Completed: ' + completedCount + '\n- Remaining: ' + (totalAssignments - completedCount) + '\n\nSTUDENT SCHEDULE:\n' + scheduleText + '\n\nSYLLABUS INFORMATION:\n' + syllabiText + '\n\nPENDING ASSIGNMENTS:\n' + pendingText + '\n\nINSTRUCTIONS:\n1. GRADE IMPACT: Use exact numbers from data\n2. TIME ESTIMATES: Provide hours for each assignment\n3. WORKLOAD BALANCE: Identify light/heavy weeks\n4. DEPENDENCIES: Show which assignments build on each other\n5. PREVENTION: Provide specific dates to start early\n6. OFFICE HOURS: Check schedule conflicts\n7. EXTRA CREDIT: Rank by ROI\n8. SEMESTER STRATEGY: Explain current phase\n\nRespond with JSON only (no markdown):\n{\n  "top": "Assignment with due date",\n  "reason": "Why priority with time estimate",\n  "gradeImpact": "Exact calculations",\n  "comparative": "Compare top priorities",\n  "nextWeeks": "List 4-6 upcoming",\n  "leverage": "Top 3 highest-impact",\n  "today": "Action for TODAY",\n  "schedule": "Reference time blocks",\n  "office": "Office hours",\n  "extra": "Extra credit by ROI",\n  "risks": ["Risks with prevention"],\n  "workloadBalance": "Weekly analysis",\n  "dependencies": "Assignment order",\n  "semesterStrategy": "Phase context",\n  "cushionTracking": "Performance tracking"\n}';
      
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          messages: [{ role: 'user', content: promptContent }]
        })
      });
      
      const d = await res.json();
      
      if (d.error) {
        console.error('API Error:', d.error);
        const errorMessage = d.error.message || 'API error occurred';
        setRecs({ 
          top: 'Error', 
          reason: errorMessage,
          gradeImpact: '',
          comparative: '',
          nextWeeks: '',
          today: '',
          schedule: '',
          office: '',
          extra: '',
          risks: [],
          leverage: '',
          workloadBalance: '',
          dependencies: '',
          semesterStrategy: '',
          cushionTracking: ''
        });
        setLoading(false);
        return;
      }
      
      const text = d.content[0].text.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
      const parsedRecs = JSON.parse(text);
      
      setRecs({
        top: parsedRecs.top || 'No priority',
        reason: parsedRecs.reason || '',
        gradeImpact: parsedRecs.gradeImpact || '',
        comparative: parsedRecs.comparative || '',
        nextWeeks: parsedRecs.nextWeeks || '',
        leverage: parsedRecs.leverage || '',
        today: parsedRecs.today || '',
        schedule: parsedRecs.schedule || '',
        office: parsedRecs.office || '',
        extra: parsedRecs.extra || '',
        risks: parsedRecs.risks || [],
        workloadBalance: parsedRecs.workloadBalance || '',
        dependencies: parsedRecs.dependencies || '',
        semesterStrategy: parsedRecs.semesterStrategy || '',
        cushionTracking: parsedRecs.cushionTracking || ''
      });
    } catch (e) {
      console.error('Recommendation Error:', e);
      const errorMsg = 'Please try again. Error: ' + String(e.message || e);
      setRecs({ 
        top: 'Error generating recommendations', 
        reason: errorMsg,
        gradeImpact: '',
        comparative: '',
        nextWeeks: '',
        today: '',
        schedule: '',
        office: '',
        extra: '',
        risks: [],
        leverage: '',
        workloadBalance: '',
        dependencies: '',
        semesterStrategy: '',
        cushionTracking: ''
      });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-white flex items-center justify-center gap-3">
            <Brain className="w-10 h-10 text-purple-400" />Academic Agent
          </h1>
          <p className="text-purple-300">Smart academic advisor with AI-powered features</p>
        </div>

        <div className="flex gap-2 mb-6 bg-white/5 rounded-xl p-2 border border-purple-500/30">
          {[['overview', 'Overview'], ['grades', 'Grades'], ['calendar', 'Calendar'], ['context', 'Context']].map(([t, l]) => (
            <button key={t} onClick={() => setTab(t)} className={'flex-1 px-4 py-2 rounded-lg font-semibold transition-all ' + (tab === t ? 'bg-purple-600 text-white' : 'text-purple-300 hover:text-white')}>{l}</button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="bg-white/10 rounded-xl p-6 border border-purple-500/30">
              <div className="flex justify-between mb-4">
                <h2 className="text-2xl font-bold text-white">Recommendations</h2>
                <button onClick={getRecs} disabled={loading || !courses.length} className="bg-purple-600 text-white px-6 py-2 rounded-lg">
                  {loading ? 'Analyzing...' : 'Get Recommendations'}
                </button>
              </div>
              {recs ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  <HoverCard 
                    icon="🎯" 
                    title="Top Priority" 
                    preview={recs.top.split(' ').slice(0, 4).join(' ') + '...'}
                    content={recs.top + '\n\n' + recs.reason}
                    gradient="from-purple-600 to-purple-800"
                    pulse={true}
                  />
                  
                  {recs.gradeImpact && (
                    <HoverCard 
                      icon="📊" 
                      title="Grade Impact" 
                      preview="Score scenarios"
                      content={recs.gradeImpact}
                      gradient="from-green-600 to-emerald-800"
                    />
                  )}

                  {recs.comparative && (
                    <HoverCard 
                      icon="⚖️" 
                      title="Compare Options" 
                      preview="Priority tradeoffs"
                      content={recs.comparative}
                      gradient="from-blue-600 to-cyan-800"
                    />
                  )}

                  {recs.nextWeeks && (
                    <HoverCard 
                      icon="📅" 
                      title="Next 2 Weeks" 
                      preview="Upcoming deadlines"
                      content={recs.nextWeeks}
                      gradient="from-cyan-600 to-teal-800"
                    />
                  )}

                  {recs.leverage && (
                    <HoverCard 
                      icon="💎" 
                      title="High Impact" 
                      preview="Biggest opportunities"
                      content={recs.leverage}
                      gradient="from-indigo-600 to-purple-800"
                    />
                  )}
                  
                  {recs.today && (
                    <HoverCard 
                      icon="📋" 
                      title="Today's Action" 
                      preview="Start now"
                      content={recs.today}
                      gradient="from-pink-600 to-rose-800"
                    />
                  )}
                  
                  {recs.schedule && (
                    <HoverCard 
                      icon="🕐" 
                      title="Study Blocks" 
                      preview="This week's schedule"
                      content={recs.schedule}
                      gradient="from-amber-600 to-orange-800"
                    />
                  )}
                  
                  {recs.office && (
                    <HoverCard 
                      icon="👨‍🏫" 
                      title="Office Hours" 
                      preview="Get help"
                      content={recs.office}
                      gradient="from-violet-600 to-purple-800"
                    />
                  )}
                  
                  {recs.extra && (
                    <HoverCard 
                      icon="⭐" 
                      title="Extra Credit" 
                      preview="Bonus opportunities"
                      content={recs.extra}
                      gradient="from-yellow-600 to-amber-800"
                    />
                  )}
                  
                  {recs.risks && recs.risks.length > 0 && (
                    <HoverCard 
                      icon="⚠️" 
                      title="Risk Alerts" 
                      preview={recs.risks.length + ' warnings'}
                      content={recs.risks.map((r, i) => '• ' + r).join('\n\n')}
                      gradient="from-red-600 to-rose-800"
                    />
                  )}
                  
                  {recs.workloadBalance && (
                    <HoverCard 
                      icon="📊" 
                      title="Workload Balance" 
                      preview="Weekly distribution"
                      content={recs.workloadBalance}
                      gradient="from-teal-600 to-cyan-800"
                    />
                  )}
                  
                  {recs.dependencies && (
                    <HoverCard 
                      icon="🔗" 
                      title="Dependencies" 
                      preview="Assignment order"
                      content={recs.dependencies}
                      gradient="from-orange-600 to-red-800"
                    />
                  )}
                  
                  {recs.semesterStrategy && (
                    <HoverCard 
                      icon="🎓" 
                      title="Semester Strategy" 
                      preview="Long-term planning"
                      content={recs.semesterStrategy}
                      gradient="from-purple-600 to-indigo-800"
                    />
                  )}
                  
                  {recs.cushionTracking && (
                    <HoverCard 
                      icon="📈" 
                      title="Grade Cushion" 
                      preview="Performance tracking"
                      content={recs.cushionTracking}
                      gradient="from-emerald-600 to-green-800"
                    />
                  )}
                </div>
              ) : <p className="text-purple-300 text-center py-8">Add courses to get started</p>}
            </div>

            <AddCourseForm onAdd={addCourse} />
            
            <div className="space-y-4">
              {courses.map(c => (
                <CourseCard key={c.id} course={c} onAddAssignment={addAssignment} onUpdateStatus={updateStatus} onUpdateScore={updateScore} onDelete={deleteCourse} onDeleteAssignment={deleteAssignment} calcImpact={calcImpact} />
              ))}
            </div>
          </div>
        )}

        {tab === 'grades' && (
          <div className="bg-white/10 rounded-xl p-6 border border-purple-500/30">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Calculator className="w-6 h-6 text-purple-400" />
              Grade Impact Calculator
            </h2>
            <p className="text-purple-300 mb-6">See exactly how each assignment affects your course grade</p>
            {courses.map(c => {
              const pending = c.assignments.filter(a => a.status !== 'completed');
              if (!pending.length) return null;
              return (
                <div key={c.id} className="mb-6">
                  <h3 className="text-xl font-bold text-white mb-3">{c.name}</h3>
                  {pending.map(a => {
                    const imp = calcImpact(c, a);
                    return (
                      <div key={a.id} className="bg-white/5 rounded-lg p-4 mb-3 border border-purple-500/20">
                        <h4 className="text-white font-semibold mb-2">{a.name} ({a.weight}% of final grade)</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {[['100%', imp.if100, 'green'], ['90%', imp.if90, 'blue'], ['80%', imp.if80, 'yellow'], ['70%', imp.if70, 'red']].map(([l, v, color]) => (
                            <div key={l} className={'bg-' + color + '-500/20 rounded p-3 text-center border border-' + color + '-400/30'}>
                              <p className={'text-' + color + '-300 font-semibold text-xs mb-1'}>If you score {l}</p>
                              <p className="text-white font-bold text-xl">{v}%</p>
                              <p className={'text-' + color + '-200 text-xs mt-1'}>
                                {v - imp.current >= 0 ? '+' : ''}{(v - imp.current).toFixed(1)}% impact
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {courses.every(c => !c.assignments.some(a => a.status !== 'completed')) && (
              <p className="text-purple-300 text-center py-8">No pending assignments</p>
            )}
          </div>
        )}

        {tab === 'calendar' && (
          <div className="bg-white/10 rounded-xl p-6 border border-purple-500/30">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Calendar className="w-6 h-6 text-purple-400" />
              Semester Calendar & Study Schedule
            </h2>
            <CalendarView courses={courses} context={context} />
          </div>
        )}

        {tab === 'context' && (
          <div className="space-y-4">
            <div className="bg-white/10 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-3">Schedule</h2>
              <textarea value={context.schedule} onChange={(e) => saveCtx({ ...context, schedule: e.target.value })} placeholder="Monday: 9am-12pm Classes..." className="w-full h-40 px-4 py-3 rounded-lg bg-white/10 border border-purple-500/30 text-white" />
            </div>
            <div className="bg-white/10 rounded-xl p-6">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-xl font-bold text-white">Syllabus Info</h2>
                <label className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg cursor-pointer transition-all flex items-center gap-2">
                  {uploadingSyllabus ? 'Uploading...' : '📄 Upload Syllabus'}
                  <input 
                    type="file" 
                    accept=".txt,.pdf,.doc,.docx" 
                    onChange={handleSyllabusUpload}
                    disabled={uploadingSyllabus}
                    className="hidden"
                  />
                </label>
              </div>
              <p className="text-purple-300 text-sm mb-3">Upload a syllabus file (TXT, PDF) and the AI will automatically extract relevant information</p>
              <textarea value={context.syllabi} onChange={(e) => saveCtx({ ...context, syllabi: e.target.value })} placeholder="Paste syllabi (office hours, extra credit, policies)..." className="w-full h-48 px-4 py-3 rounded-lg bg-white/10 border border-purple-500/30 text-white" />
            </div>
          </div>
        )}
      </div>
      
      <div className="fixed bottom-6 right-6 z-50">
        {!chatOpen ? (
          <button 
            onClick={() => setChatOpen(true)}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full p-4 shadow-2xl hover:scale-110 transition-transform duration-300 flex items-center gap-2"
          >
            <MessageSquare className="w-6 h-6" />
            <span className="font-semibold">Chat with Agent</span>
          </button>
        ) : (
          <div className="bg-gradient-to-br from-slate-900 to-purple-900 rounded-2xl shadow-2xl border-2 border-purple-500/30 w-96 h-[600px] flex flex-col">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4 rounded-t-2xl flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-white" />
                <h3 className="font-bold text-white">Academic Agent</h3>
              </div>
              <button onClick={() => setChatOpen(false)} className="text-white hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div 
              className="flex-1 p-4 space-y-3"
              ref={chatContainerRef}
              onScroll={handleChatScroll}
              style={{
                overflowY: 'scroll',
                overflowX: 'hidden',
                maxHeight: '450px',
                scrollBehavior: 'smooth'
              }}
            >
              <style>{`
                div[style*="overflowY: scroll"]::-webkit-scrollbar {
                  width: 12px;
                }
                div[style*="overflowY: scroll"]::-webkit-scrollbar-track {
                  background: #1e1b4b;
                  border-radius: 10px;
                }
                div[style*="overflowY: scroll"]::-webkit-scrollbar-thumb {
                  background: #9333ea;
                  border-radius: 10px;
                  border: 2px solid #1e1b4b;
                }
                div[style*="overflowY: scroll"]::-webkit-scrollbar-thumb:hover {
                  background: #a855f7;
                }
              `}</style>
              
              {chatMessages.length === 0 && (
                <div className="text-center text-purple-300 py-8">
                  <p className="mb-2">👋 Hi! I am your academic advisor.</p>
                  <p className="text-sm">Ask me anything about your semester, assignments, or just let me know what you have completed!</p>
                </div>
              )}
              
              {chatMessages.map((msg, i) => (
                <div key={i} className={'flex ' + (msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={'max-w-[80%] rounded-2xl px-4 py-2 ' + (msg.role === 'user' ? 'bg-purple-600 text-white' : 'bg-white/10 text-purple-100 border border-purple-500/30')}>
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                  </div>
                </div>
              ))}
              
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-white/10 border border-purple-500/30 rounded-2xl px-4 py-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-purple-500/30">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !chatLoading && sendChatMessage()}
                  placeholder="Ask me anything..."
                  className="flex-1 px-4 py-2 rounded-lg bg-white/10 border border-purple-500/30 text-white placeholder-purple-300 focus:outline-none focus:border-purple-400"
                  disabled={chatLoading}
                />
                <button
                  onClick={sendChatMessage}
                  disabled={chatLoading || !chatInput.trim()}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AddCourseForm({ onAdd }) {
  const [show, setShow] = useState(false);
  return show ? (
    <div className="bg-white/10 rounded-xl p-6 border border-purple-500/30">
      <h3 className="text-lg font-bold text-white mb-4">Add New Course</h3>
      <input id="cn" type="text" placeholder="Course name" className="w-full px-4 py-2 rounded-lg bg-white/10 border border-purple-500/30 text-white mb-3" />
      <input id="cg" type="number" placeholder="Current grade (0 if semester hasn't started)" className="w-full px-4 py-2 rounded-lg bg-white/10 border border-purple-500/30 text-white mb-3" />
      <div className="flex gap-2">
        <button onClick={() => { const n = document.getElementById('cn').value; if (n) { onAdd(n, document.getElementById('cg').value); setShow(false); }}} className="bg-purple-600 text-white px-4 py-2 rounded-lg">Add Course</button>
        <button onClick={() => setShow(false)} className="bg-gray-600 text-white px-4 py-2 rounded-lg">Cancel</button>
      </div>
    </div>
  ) : (
    <button onClick={() => setShow(true)} className="bg-purple-600 text-white px-6 py-3 rounded-lg flex items-center gap-2"><Plus className="w-5 h-5" />Add Course</button>
  );
}

function CourseCard({ course, onAddAssignment, onUpdateStatus, onUpdateScore, onDelete, onDeleteAssignment }) {
  const [show, setShow] = useState(false);
  return (
    <div className="bg-white/10 rounded-xl p-6 border border-purple-500/30">
      <div className="flex justify-between mb-4">
        <h2 className="text-2xl font-bold text-white">{course.name}</h2>
        <button onClick={() => onDelete(course.id)} className="text-red-400 hover:text-red-300"><X className="w-5 h-5" /></button>
      </div>
      
      {course.assignments.map(a => (
        <div key={a.id} className="bg-white/5 rounded-lg p-4 mb-3 border border-purple-500/20 hover:bg-white/10 transition-all">
          <div className="flex justify-between mb-2">
            <div>
              <h3 className="text-white font-semibold">{a.name}</h3>
              <p className="text-purple-300 text-sm">{new Date(a.dueDate).toLocaleDateString()} | {a.weight}%</p>
            </div>
            <button onClick={() => onDeleteAssignment(course.id, a.id)} className="text-red-400 hover:text-red-300"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex gap-2">
            <select value={a.status} onChange={(e) => onUpdateStatus(course.id, a.id, e.target.value)} className="bg-purple-600/30 text-white px-3 py-1 rounded text-sm border border-purple-500/30">
              <option value="not_started">Not Started</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
            {a.status === 'completed' && <input type="number" placeholder="Score %" value={a.score || ''} onChange={(e) => onUpdateScore(course.id, a.id, e.target.value)} className="w-24 px-3 py-1 rounded bg-white/10 text-white text-sm border border-purple-500/30" />}
          </div>
        </div>
      ))}

      {!show ? (
        <button onClick={() => setShow(true)} className="text-purple-300 hover:text-purple-200 flex items-center gap-2 transition-all"><Plus className="w-4 h-4" />Add Assignment</button>
      ) : (
        <div className="bg-white/5 rounded-lg p-4 space-y-3 border border-purple-500/20">
          <input id={'an' + course.id} type="text" placeholder="Assignment name" className="w-full px-3 py-2 rounded bg-white/10 text-white text-sm border border-purple-500/30" />
          <div className="flex gap-2">
            <input id={'ad' + course.id} type="date" className="flex-1 px-3 py-2 rounded bg-white/10 text-white text-sm border border-purple-500/30" />
            <input id={'aw' + course.id} type="number" placeholder="Weight %" className="w-24 px-3 py-2 rounded bg-white/10 text-white text-sm border border-purple-500/30" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => { const n = document.getElementById('an' + course.id).value; const d = document.getElementById('ad' + course.id).value; const w = document.getElementById('aw' + course.id).value; if (n && d && w) { onAddAssignment(course.id, n, d, w); setShow(false); }}} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-sm">Add</button>
            <button onClick={() => setShow(false)} className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function HoverCard({ icon, title, preview, content, gradient, pulse }) {
  const [isHovered, setIsHovered] = useState(false);
  
  const formatContent = (text) => {
    if (title === 'Workload Balance' || title === 'Grade Cushion') {
      return text.split('\n').map((line, i) => {
        if (line.trim().startsWith('-') || line.trim().startsWith('•')) {
          return <div key={i} className="ml-4 mb-2">{line}</div>;
        } else if (line.trim().match(/^[A-Z][A-Za-z\s]+:/)) {
          return <div key={i} className="font-bold mt-3 mb-1 text-purple-300">{line}</div>;
        } else if (line.trim()) {
          return <div key={i} className="mb-2">{line}</div>;
        }
        return <div key={i} className="mb-2"></div>;
      });
    }
    return <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">{content}</p>;
  };
  
  return (
    <div
      className="relative group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={'bg-gradient-to-br ' + gradient + ' rounded-2xl p-6 border-2 border-white/20 shadow-2xl transform transition-all duration-300 hover:scale-105 hover:rotate-1 cursor-pointer' + (pulse ? ' animate-pulse' : '')}>
        <div className="text-6xl mb-3 text-center">{icon}</div>
        <h3 className="text-white font-bold text-lg text-center mb-2">{title}</h3>
        <p className="text-white/80 text-sm text-center">{preview}</p>
      </div>
      
      {isHovered && content && (
        <div className="absolute z-50 top-full left-1/2 transform -translate-x-1/2 mt-2 w-96 max-w-[90vw] bg-gray-900 border-2 border-white/30 rounded-xl p-5 shadow-2xl">
          <div className="text-2xl mb-2">{icon}</div>
          <h4 className="text-white font-bold text-lg mb-3">{title}</h4>
          <div className="text-gray-200 text-sm leading-relaxed max-h-96 overflow-y-auto">
            {formatContent(content)}
          </div>
          <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-gray-900 border-l-2 border-t-2 border-white/30 rotate-45"></div>
        </div>
      )}
    </div>
  );
}

function CalendarView({ courses, context }) {
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [hoveredBlock, setHoveredBlock] = useState(null);
  
  const semesterStart = new Date('2026-01-16');
  const allAssignments = courses.flatMap(c => c.assignments.map(a => ({ ...a, course: c.name })));
  
  const weeks = [];
  for (let i = 0; i < 16; i++) {
    const weekStart = new Date(semesterStart);
    weekStart.setDate(semesterStart.getDate() + (i * 7));
    weeks.push(weekStart);
  }
  
  const currentWeekStart = weeks[selectedWeek];
  const days = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(currentWeekStart);
    day.setDate(currentWeekStart.getDate() + i);
    days.push(day);
  }
  
  const timeBlocks = ['8 AM', '9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', '6 PM', '7 PM'];
  
  const getAssignmentsForDay = (day) => {
    return allAssignments.filter(a => new Date(a.dueDate).toDateString() === day.toDateString());
  };
  
  const convertTo24Hour = (hour, period) => {
    if (!period) return hour;
    if (period.toUpperCase() === 'PM' && hour !== 12) return hour + 12;
    if (period.toUpperCase() === 'AM' && hour === 12) return 0;
    return hour;
  };
  
  const parseSchedule = () => {
    const schedule = {};
    if (!context || !context.schedule) return schedule;
    
    const lines = context.schedule.split('\n');
    let currentDay = '';
    
    lines.forEach(line => {
      const dayMatch = line.match(/^(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY):/i);
      if (dayMatch) {
        currentDay = dayMatch[1].charAt(0) + dayMatch[1].slice(1).toLowerCase();
        schedule[currentDay] = [];
      } else if (currentDay && line.trim()) {
        const timeMatch = line.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?.*?-\s*(\d{1,2}):(\d{2})\s*(AM|PM)?.*?-\s*(.+)/i);
        if (timeMatch) {
          const startHour = timeMatch[1];
          const startPeriod = timeMatch[3];
          const endHour = timeMatch[4];
          const endPeriod = timeMatch[6];
          const description = timeMatch[7];
          schedule[currentDay].push({
            startHour: convertTo24Hour(parseInt(startHour), startPeriod),
            endHour: convertTo24Hour(parseInt(endHour), endPeriod),
            description: description.trim()
          });
        }
      }
    });
    
    return schedule;
  };
  
  const scheduleData = parseSchedule();
  
  const getBlockInfo = (day, hour24) => {
    const dayName = day.toLocaleDateString('en-US', { weekday: 'long' });
    const pending = courses.flatMap(c => c.assignments.filter(a => a.status !== 'completed')).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    
    if (scheduleData[dayName]) {
      for (const event of scheduleData[dayName]) {
        if (hour24 >= event.startHour && hour24 < event.endHour) {
          const desc = event.description.toLowerCase();
          let type = 'free';
          if (desc.includes('class') || desc.includes('lecture') || /[A-Z]{2,4}\s*\d{3}/.test(event.description)) {
            type = 'class';
          } else if (desc.includes('study') || desc.includes('work')) {
            type = 'study';
          } else if (desc.includes('office')) {
            type = 'office';
          }
          
          let detail = event.description;
          if (type === 'study' && pending.length > 0) {
            const urgentAssignments = pending.filter(a => {
              const daysUntil = Math.ceil((new Date(a.dueDate) - day) / 864e5);
              return daysUntil >= 0 && daysUntil <= 7;
            });
            if (urgentAssignments.length > 0) {
              const dueDate = new Date(urgentAssignments[0].dueDate).toLocaleDateString();
              detail += '\n\n🎯 RECOMMENDED FOCUS:\n' + urgentAssignments[0].name + ' (' + urgentAssignments[0].course + ')\nDue: ' + dueDate + '\nWeight: ' + urgentAssignments[0].weight + '%';
            }
          }
          
          return { 
            type, 
            label: event.description.split('-')[0].trim().substring(0, 20),
            detail 
          };
        }
      }
    }
    
    return { type: 'free', label: '', detail: '' };
  };
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <button onClick={() => setSelectedWeek(Math.max(0, selectedWeek - 1))} disabled={selectedWeek === 0} className="bg-purple-600 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-all hover:scale-105">← Prev</button>
        <h3 className="text-lg font-bold text-white">Week of {currentWeekStart.toLocaleDateString()}</h3>
        <button onClick={() => setSelectedWeek(Math.min(15, selectedWeek + 1))} disabled={selectedWeek === 15} className="bg-purple-600 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-all hover:scale-105">Next →</button>
      </div>
      
      <div className="bg-white/5 rounded-xl p-4 border border-purple-500/20 overflow-x-auto">
        <div className="grid grid-cols-8 gap-1 min-w-[1400px]">
          <div className="text-purple-300 text-xs font-bold p-2">Time</div>
          {days.map((day, i) => {
            const dueToday = getAssignmentsForDay(day);
            return (
              <div key={i} className="text-center p-2">
                <div className="font-bold text-white">{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                <div className="text-xs text-purple-300">{day.getMonth() + 1 + '/' + day.getDate()}</div>
                {dueToday.length > 0 && (
                  <div className="mt-1 space-y-1">
                    {dueToday.map((a, j) => {
                      const assignmentId = 'due-' + i + '-' + j;
                      return (
                        <div 
                          key={j} 
                          className="relative group"
                          onMouseEnter={() => setHoveredBlock(assignmentId)}
                          onMouseLeave={() => setHoveredBlock(null)}
                        >
                          <div className="text-xs bg-red-600 text-white px-2 py-1 rounded font-bold cursor-pointer hover:bg-red-500 transition-all">
                            DUE: {a.name.slice(0, 15)}
                          </div>
                          {hoveredBlock === assignmentId && (
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-64 bg-gray-900 border-2 border-red-500 rounded-lg p-3 shadow-2xl z-50">
                              <p className="text-red-400 font-bold text-sm mb-2">{a.name}</p>
                              <p className="text-white text-xs mb-1">Course: {a.course}</p>
                              <p className="text-white text-xs mb-1">Weight: {a.weight}%</p>
                              <p className="text-white text-xs">Due: {new Date(a.dueDate).toLocaleDateString()}</p>
                              <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-gray-900 border-l-2 border-t-2 border-red-500 rotate-45"></div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          
          {timeBlocks.map((time, timeIdx) => {
            const hour24 = timeIdx + 8;
            return (
              <React.Fragment key={timeIdx}>
                <div className="text-xs text-purple-300 p-2 flex items-center">{time}</div>
                {days.map((day, dayIdx) => {
                  const blockInfo = getBlockInfo(day, hour24);
                  const blockId = dayIdx + '-' + timeIdx;
                  
                  const blockClass = 'min-h-[70px] p-2 rounded border-2 transition-all duration-200 cursor-pointer relative ' + (
                    blockInfo.type === 'class' ? 'bg-blue-600/30 border-blue-400 hover:bg-blue-600/50' :
                    blockInfo.type === 'study' ? 'bg-green-600/30 border-green-400 hover:bg-green-600/50' :
                    blockInfo.type === 'office' ? 'bg-purple-600/30 border-purple-400 hover:bg-purple-600/50' :
                    'bg-white/5 border-purple-500/10 hover:bg-white/10'
                  ) + (hoveredBlock === blockId ? ' scale-105 z-10 shadow-2xl' : '');
                  
                  return (
                    <div
                      key={dayIdx}
                      className={blockClass}
                      onMouseEnter={() => setHoveredBlock(blockId)}
                      onMouseLeave={() => setHoveredBlock(null)}
                    >
                      {blockInfo.label && (
                        <div className="text-xs font-bold text-white text-center">{blockInfo.label}</div>
                      )}
                      {hoveredBlock === blockId && blockInfo.detail && (
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-64 bg-gray-900 border-2 border-white/50 rounded-lg p-3 shadow-2xl z-50">
                          <p className="text-white text-xs leading-relaxed whitespace-pre-wrap">{blockInfo.detail}</p>
                          <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-gray-900 border-l-2 border-t-2 border-white/50 rotate-45"></div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      </div>
      
      <div className="flex gap-4 text-sm flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-blue-600/30 border-2 border-blue-400 rounded"></div>
          <span className="text-purple-300">Classes</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-green-600/30 border-2 border-green-400 rounded"></div>
          <span className="text-purple-300">Study Blocks</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-purple-600/30 border-2 border-purple-400 rounded"></div>
          <span className="text-purple-300">Office Hours</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-red-600 rounded"></div>
          <span className="text-purple-300">Due Dates</span>
        </div>
      </div>
    </div>
  );
}
