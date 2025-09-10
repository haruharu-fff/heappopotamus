import React, { useState, useEffect } from "react";

import "./App.css";
import "./task.css";
import "./modal.css";
import { TaskAddModal } from "./taskaddmodal";

import { auth, db, provider } from "./firebase";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import type { User } from "firebase/auth";
import { collection, doc, setDoc,deleteDoc, onSnapshot, updateDoc} from "firebase/firestore";
import {v4 as uuidv4} from "uuid";

let highPriorityColor = "#FF0000";
let midiumPriorityColor = "#FFFF00";
let lowPriorityColor = "#00FF00";

type TaskElement = {
    id: string;
    name: string;
    description: string;
    deadline: string;
    location: string;
    status: "active" | "completed" | "deleted";
    updatedAt: string;
};

let heapq: TaskElement[] = [];

function compareDates(a: string, b: string): number {
  if (a === "ASAP" && b === "ASAP") return 0;
  if (a === "ASAP") return -1;
  if (b === "ASAP") return 1;
  return a.localeCompare(b);
}

const color = (task: TaskElement): string => {
  if (task.deadline === "ASAP") return highPriorityColor;
  const now = new Date();
  let year = 0,
    month = 0,
    day = 0,
    hour = 0,
    minute = 0;
  if (task.deadline.length === 8) {
    year = Number(task.deadline.slice(0, 4));
    month = Number(task.deadline.slice(4, 6)) - 1;
    day = Number(task.deadline.slice(6, 8));
  } else if (task.deadline.length === 12) {
    year = Number(task.deadline.slice(0, 4));
    month = Number(task.deadline.slice(4, 6)) - 1;
    day = Number(task.deadline.slice(6, 8));
    hour = Number(task.deadline.slice(8, 10));
    minute = Number(task.deadline.slice(10, 12));
  } else return lowPriorityColor;

  const deadline = new Date(year, month, day, hour, minute);
  const diffHours = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (diffHours <= 24) return highPriorityColor;
  if (diffHours <= 72) return midiumPriorityColor;
  return lowPriorityColor;
};

const parse_deadline = (str: string): string => {
  if (str === "ASAP") return "ASAP";
  if (str.length === 8) return str.slice(0, 4) + "-" + str.slice(4, 6) + "-" + str.slice(6, 8);
  if (str.length === 12)
    return (
      str.slice(0, 4) +
      "-" +
      str.slice(4, 6) +
      "-" +
      str.slice(6, 8) +
      " " +
      str.slice(8, 10) +
      ":" +
      str.slice(10, 12)
    );
  return "不正な日付";
};

function linkify(text: string): React.ReactNode[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) =>
    urlRegex.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer">{part}</a>
    ) : (
      part
    )
  );
}

const heapify = () => {
  heapq.sort((a, b) => compareDates(a.deadline, b.deadline));
};

const delete_task = (task: TaskElement) => {
    const idx = heapq.findIndex(t=>t.id===task.id);
    if (idx!== -1) heapq.splice(idx,1);
    heapify();
};

type TaskProps = {
  name: string;
  deadline: string;
  backgroundColor: string;
  onClick?: () => void;
};

function Task({ name, deadline, backgroundColor, onClick }: TaskProps) {
  return (
    <button className="task" style={{ backgroundColor }} onClick={onClick}>
      <span className="name">{name}</span>
      <span className="deadline">{parse_deadline(deadline)}</span>
    </button>
  );
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<TaskElement[]>([]);
  const [filter,setFilter] = useState<"active" | "completed" | "deleted">("active");
  const [modalTask, setModalTask] = useState<TaskElement | null>(null);
  const [TaskAddModalOpen, setTaskAddModalOpen] = useState(false);
  const [TaskDetailModalOpen, setTaskDetailModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskElement | null>(null);

    // タスク追加/編集モーダルの関数を定義
    const TaskAddModal_open=(task?: TaskElement|null)=>{
        setModalTask(task ?? null);
        setTaskAddModalOpen(true);
    }

  const TaskDetailModal_close=()=>{
        setTaskDetailModalOpen(false);
        setSelectedTask(null);
    }

    //表示切替ボタンの処理
    const toggleFilter = () => {
        setFilter(prev => {
            if (prev === "active") return "completed";
            if (prev === "completed") return "deleted";
            return "active";
        });
    };

  // Firebase 認証監視
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser: User | null) => setUser(currentUser));
    return () => unsubscribe();
  }, []);

  // Firestore からユーザーデータ取得
  useEffect(() => {
    if (!user) return;
    const tasksCol = collection(db, "users", user.uid, "tasks");
    const unsub = onSnapshot(tasksCol, async(snapshot) => {
      const arr: TaskElement[] = [];
      
        const now=new Date();
        for (const docSnap of snapshot.docs) {
            const task=docSnap.data() as TaskElement;
            arr.push(task);
            const updatedAt=new Date(task.updatedAt);
            const diffDays = (now.getTime() - updatedAt.getTime())/(1000*60*60*24);
            if (diffDays>=30 && task.status!== "active"){
                const taskRef=doc(tasksCol,task.id);
                await deleteDoc(taskRef);
            }
        }
        heapq = arr.filter(task => !(new Date(task.updatedAt).getTime() + 30*24*60*60*1000 <= now.getTime() && task.status !== "active"));
        heapify();
        setTasks([...heapq]);
    });
    return () => unsub();
  }, [user]);

  const handleLogin = async () => {
    if (!user) await signInWithPopup(auth, provider);
  };
  const handleLogout = async () => {
    if (user) await signOut(auth);
  };

  const saveTask = async (newTask: TaskElement) => {
    if (!user) return;
    const tasksCol = collection(db, "users", user.uid, "tasks");

    newTask.updatedAt=new Date().toISOString();
    //新規タスクならidを生成
    if (!newTask.id){
        newTask.id=uuidv4();
    }

    //編集時はupdateDocで
    const taskRef=doc(tasksCol,newTask.id);
    await setDoc(taskRef,newTask);

    setTaskAddModalOpen(false);
  };

  console.log("user:",user);
  console.log("tasks:",tasks);

  if (!user) {
    return (
      <div style={{ textAlign: "center", marginTop: "50px" }}>
        <h2>ログインしてください</h2>
        <button onClick={handleLogin}>Googleでログイン</button>
      </div>
    );
  }

  return (
    <>
        <img src="/heapo.png" alt="ヒーポくん" style={{ maxWidth: "20%", height: "auto" }} />
        <div 
        style={{ 
            textAlign: "right", 
            padding: "10px", 
            display: "flex", 
            alignItems: "center",   // ← 縦方向を中央揃え 
            justifyContent: "center", 
            gap: "10px"             // ← 要素間の余白
        }}
        >
            {user.photoURL && (
                <img 
                src={user.photoURL} 
                alt="User Icon" 
                style={{ width: "32px", height: "32px", borderRadius: "50%" }} 
                />
            )}
            <span>{user.displayName}</span>
            <button onClick={handleLogout}>ログアウト</button>
        </div>
        <div
            style={{
                position: "fixed",
                top: "10px",
                right: "10px",
                zIndex: 1000,
                }}>
            <button
                onClick={toggleFilter}
                style={{
                    padding: "8px 12px",
                    borderRadius: "0",
                    border: "1px solid black",
                    backgroundColor: "#f0f0f0",
                    cursor: "pointer",
                }}>
                {filter === "active" && "active"}
                {filter === "completed" && "completed"}
                {filter === "deleted" && "deleted"}
            </button>
        </div>
        <div className="tasks">
        {tasks.filter(task => task.status === filter).length > 0 ? (
            tasks.filter(task=>task.status === filter).map((task) =>
                <Task
                key={task.id}
                name={task.name}
                deadline={task.deadline}
                backgroundColor={color(task)}
                onClick={() => {
                    setSelectedTask(task);
                    setTaskDetailModalOpen(true);
                }}
                />
            )
        ) : (
            <h2>
                {filter === "active" && "現在抱えているタスクはありません。"}
                {filter === "completed" && "完了済みのタスクはありません。"}
                {filter === "deleted" && "削除済みのタスクはありません。"}
            </h2>
        )}
        </div>


      <button className="task-add-button" onClick={() => setTaskAddModalOpen(true)}>＋</button>

      {TaskAddModalOpen && (
        <TaskAddModal
          task={modalTask}
          onClose={() => setTaskAddModalOpen(false)}
          onSave={(newTask) => saveTask(newTask)}
        />
      )}
    {/* タスク詳細モーダル */}
    {TaskDetailModalOpen && selectedTask && (
        <div className="modal-background" onClick={TaskDetailModal_close}> {/* 背景がクリックされたときにモーダルを閉じる */}
            <div className="modal-content" onClick={(e)=>e.stopPropagation()}> {/* ここでイベントの伝播を止める */}
                <button className="modal-close-button" onClick={TaskDetailModal_close}>
                    &times;
                    </button>
                <h2>{selectedTask.name}</h2>
                <p>{linkify(selectedTask.description)}</p> {/* リンク化 */}
                <br></br>
                <p>&#x1f4c5;{parse_deadline(selectedTask.deadline)}</p>
                <p>&#x1f4cd;{linkify(selectedTask.location)}</p> {/* リンク化 */}
                {/* filterがactiveの時には削除、編集、完了ボタンを表示 */}
                {filter === "active" && <div className="modal-bottom-buttons">
                    <button style={{backgroundColor: "red"}}
                    onClick={async ()=>{
                        if (!user || !selectedTask) return ;
                        try{
                            //firebaseに反映
                            const taskRef = doc(db,"users",user.uid,"tasks", selectedTask.id);
                            await updateDoc(taskRef,{status:"deleted"});
                            //ローカルも更新
                            selectedTask.status="deleted"
                            alert("「"+selectedTask.name+"」を削除しました。");
                            TaskDetailModal_close();
                        } catch(error){
                            console.log("タスク削除時にエラーが発生",error);
                            alert("タスク削除に失敗しました。");
                        }
                    }
                    }>
                        &#x1f5d1; 削除</button>
                    <button style={{backgroundColor: "aliceblue"}}
                    onClick={()=>{TaskDetailModal_close();TaskAddModal_open(selectedTask);}}>
                        &#x1f58a; 編集</button>
                    <button style={{backgroundColor: "mediumspringgreen"}}
                    onClick={async ()=>{
                        if (!user || !selectedTask) return ;
                        try{
                            //firebaseに反映
                            const taskRef = doc(db,"users",user.uid,"tasks", selectedTask.id);
                            await updateDoc(taskRef,{status:"completed"});
                            //ローカルも更新
                            selectedTask.status="completed"
                            alert("「"+selectedTask.name+"」を完了しました！");
                            TaskDetailModal_close();
                        } catch(error){
                            console.log("タスク完了時にエラーが発生",error);
                            alert("タスク完了に失敗しました。");
                        }
                    }
                    }>
                        &#x2705; 完了</button>
                </div>
                }
                {/* filterがactiveでない時には削除、復元ボタンを表示 */}
                {filter !== "active" && <div className="modal-bottom-buttons">
                    <button style={{backgroundColor: "red"}}
                    onClick={async ()=>{
                        if (!user || !selectedTask) return ;
                        try{
                            //firebaseに反映
                            const taskRef = doc(db,"users",user.uid,"tasks", selectedTask.id);
                            await deleteDoc(taskRef);
                            //ローカルも更新
                            delete_task(selectedTask);
                            alert("「"+selectedTask.name+"」を完全に削除しました。");
                            TaskDetailModal_close();
                        } catch(error){
                            console.log("タスク削除時にエラーが発生",error);
                            alert("タスク削除に失敗しました。");
                        }
                    }
                    }>
                        &#x1f5d1; 削除</button>
                    <button style={{backgroundColor: "mediumspringgreen"}}
                    onClick={async ()=>{
                        if (!user || !selectedTask) return ;
                        try{
                            //firebaseに反映
                            const taskRef = doc(db,"users",user.uid,"tasks", selectedTask.id);
                            await updateDoc(taskRef,{status:"active"});
                            //ローカルも更新
                            selectedTask.status="active"
                            alert("「"+selectedTask.name+"」を復元しました。");
                            TaskDetailModal_close();
                        } catch(error){
                            console.log("タスク復元時にエラーが発生",error);
                            alert("タスク復元に失敗しました。");
                        }
                    }
                    }>
                        &#x1f504; 復元</button>
                </div>
                }
            </div>
        </div>
    )}

    </>
  );
}

export default App;
