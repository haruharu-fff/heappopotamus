import React, { useState, useEffect } from "react";
import {v4 as uuidv4} from "uuid";

type TaskElement = {
    id: string;
    name: string;
    description: string;
    deadline: string;
    location: string;
    status: "active" | "completed" | "deleted";
    updatedAt: string;
};

type TaskModalProps = {
  task?: TaskElement | null;
  onClose: () => void;
  onSave: (newTask: TaskElement) => void;
  //initialTask?: TaskElement;
};

export const TaskAddModal: React.FC<TaskModalProps> = ({ task, onClose, onSave }) => {
  const [inputs, setInputs] = useState<TaskElement>({
    id: uuidv4(),
    name: "",
    description: "",
    deadline: "",
    location: "",
    status: "active",
    updatedAt: new Date().toISOString()
  });
    const isEditMode=task!=null;
  // 編集モードの時は初期値をセット
  useEffect(() => {
    if (task) {
      setInputs(task);
    }
  }, [task]);

  const handleChange = (field: keyof Omit<TaskElement, "id" | "status">, value: string) => {
    setInputs(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = () => {
    // バリデーション確認
    if (!inputs.name && !inputs.deadline){
        alert("タスク名と締め切りは必須です。");
        return;
    }else if (!inputs.name){
        alert("タスク名は必須です。");
        return;
    }else if (!inputs.deadline){
        alert("締め切りは必須です。");
        return;
    }else{
    const taskToSave: TaskElement = {
      ...inputs,
      //id: inputs.id || uuidv4(), // 新規タスクの場合は UUID を設定
      status: inputs.status || "active",
      updatedAt: new Date().toISOString()
    };  
    onSave(taskToSave);
    onClose();
    }
  };

  return (
    <div className="modal-background" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-button" onClick={onClose}>
          &times;
        </button>
        <h2>{isEditMode ? "タスクを編集" : "タスクを追加"}</h2>
        <div className="form-row">
            <label>タスク名:</label>
            <input
            value={inputs.name}
            onChange={(e) => handleChange("name", e.target.value)}/>
        </div>
        <div className="form-row">
            <label>説明:</label>
            <input
            value={inputs.description}
            onChange={(e) => handleChange("description", e.target.value)}/>
        </div>
        <div className="form-row">
            <label>締め切り:</label>
            <input
            value={inputs.deadline}
            onChange={(e) => handleChange("deadline", e.target.value)}/>
        </div>
        <div className="form-row">
            <label>場所:</label>
            <input key={3}
            value={inputs.location}
            onChange={(e) => handleChange("location", e.target.value)}/>
        </div>

        <div className="modal-bottom-buttons">
          <button style={{ backgroundColor: "lightgreen" }} onClick={handleSave}>
            {task ? "保存" : "追加"}
          </button>
          <button style={{ backgroundColor: "lightgray" }} onClick={onClose}>
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
};
