const { ipcRenderer } = require('electron')

var notifyTimer;
var newSubTaskTemplate = { 'id': 0, 'alarmTime': '09:00:00', 'continueTime': '00:15:00', 'weatherAlarm': true, 'status': '', 'startTime': '', 'timeClassify': '' };
var newTaskTemplate = { 'editTaskTimes': 1, 'editTaskContinueTime': '00:15:00', 'id': '', 'title': '', 'subTitle': '', 'subTasks': [newSubTaskTemplate] };
var app = new Vue({
    el: '#app',
    data: {
        currentPage: 0,
        damato: '',
        tasks: [],
        timeClassifys: [['morning', { 'start': '06:00:00', 'end': '09:00:00' }], ['foreNoon', { 'start': '09:00:00', 'end': '12:00:00' }], ['noon', { 'start': '12:00:00', 'end': '14:00:00' }], ['afterNoon', { 'start': '14:00:00', 'end': '19:00:00' }], ['night', { 'start': '19:00:00', 'end': '24:00:00' }], ['other', { 'start': '00:00:00', 'end': '06:00:00' }]],
        editTask: { 'editTaskTimes': 1, 'editTaskContinueTime': '00:15:00', 'id': '', 'title': '', 'subTitle': '', 'subTasks': [newSubTaskTemplate] },
        doTask: '',
        doSubTask: '',
        detailAnalyseType: 'Detail',
        userInfo: { 'userId': '', 'userName': '', 'userTag': '', 'userPhoto': '', 'userEmail': '', 'userPhone': '', 'userSync': true, 'userOldPassw': '', 'userNewPassw': '', 'logStatus': true, 'createTime': '' },
        userEditInfo: { 'userId': '', 'userName': '', 'userTag': '', 'userPhoto': '', 'userEmail': '', 'userPhone': '', 'userSync': true, 'userOldPassw': '', 'userNewPassw': '', 'logStatus': true, 'createTime': '' },
        userInfoEditTag: false,
        signOrLog: 'log',
        feedBackText: '',
    },
    computed: {
        allSubTask: function () {
            var allSubTask = [];
            if (this.damato === '') { return allSubTask };
            for (task of this.damato.tasks) {
                for (subTask of task.subTasks) {
                    allSubTask.push({ alarmTime: subTask.alarmTime, status: subTask.status, title: task.title, subTitle: task.subTitle });
                }
            }
            return allSubTask;
        },
    },
    watch: {
        'editTask.editTaskTimes': {
            deep: true,
            handler: function (newVal) {
                // 监控 task time 变化增减subtasks
                var currentSubTasksLength = this.editTask.subTasks.length;
                if (currentSubTasksLength > newVal) {
                    for (var i = 0; i < currentSubTasksLength - newVal; i++) {
                        this.editTask.subTasks.pop();
                    }
                } else if (currentSubTasksLength < newVal) {
                    for (var i = 0; i < newVal - currentSubTasksLength; i++) {
                        var newSubTask = JSON.parse(JSON.stringify(newSubTaskTemplate));
                        newSubTask.continueTime = this.editTask.editTaskContinueTime;
                        newSubTask.id = this.editTask.subTasks.length;
                        this.classifyTime(newSubTask);
                        this.editTask.subTasks.push(newSubTask);
                    }
                }
            }
        },
    },
    created: function () {
        // 加载damato数据
        let globalDamato = require('electron').remote.getGlobal('damato');
        if (globalDamato) {
            this.damato = globalDamato;
        } else {
            alert("init damato failed");
        }
        this.nearestSubTaskTimeNotifier();
    },
    mounted: function () {
        Metro.init();
    },
    methods: {
        taskFinishedStatus: function () {
            var finishedCount = 0;
            var unFinishedCount = 0;
            for (task of this.damato.tasks) {
                for (subTask of task.subTasks) {
                    if (subTask.status === 'finished') {
                        finishedCount++;
                    } else {
                        unFinishedCount++;
                    }
                }
            }
            return { 'finishedCount': finishedCount, 'unFinishedCount': unFinishedCount };
        },
        editTaskSave: function () {
            if (!this.editTaskValidate()) {
                Metro.toast.create("Please fill in title info.", null, 5000, "alert");
                return false;
            }
            var editTask = JSON.parse(JSON.stringify(this.editTask));
            if (editTask.id === '') {
                editTask.id = this.damato.tasks.length;
                let tempTasks = JSON.parse(JSON.stringify(this.damato.tasks));
                tempTasks.push(editTask);
                this.damato.tasks = tempTasks;
            } else {
                let tempTasks = JSON.parse(JSON.stringify(this.damato.tasks));
                for (var i = 0; i < tempTasks.length; i++) {
                    if (tempTasks[i].id === editTask.id) {
                        tempTasks[i] = editTask;
                    }
                }
                this.damato.tasks = tempTasks;
            }
            this.nearestSubTaskTimeNotifier();
            this.$forceUpdate();
            this.toggleCharms();
        },
        editTaskValidate: function () {
            if (this.editTask.title === '') {
                return false;
            }
            return true;
        },
        taskEdit: function (task) {
            this.editTask = JSON.parse(JSON.stringify(task));
            if (!$(newTask_btn).hasClass('active')) {
                this.toggleCharms();
            }
        },
        taskDelete: function (task) {
            var tasks = this.damato.tasks;
            var editTask = this.editTask;
            var toggleCharms = this.toggleCharms;
            Metro.dialog.create({
                title: "Delete this task",
                content: "<div>This is a irrevocable option!</div>",
                actions: [
                    {
                        caption: "Delete",
                        cls: "js-dialog-close alert",
                        onclick: function () {
                            for (var i = 0; i < tasks.length; i++) {
                                if (tasks[i].id === editTask.id) {
                                    tasks.splice(i, 1);
                                    app.damato.tasks = tasks;
                                    app.nearestSubTaskTimeNotifier();
                                    app.$forceUpdate();
                                    break;
                                }
                            }
                            toggleCharms();
                        }
                    },
                    {
                        caption: "Cancel",
                        cls: "js-dialog-close",
                        onclick: function () {
                            return true;
                        }
                    }
                ]
            });

        },
        toggleCharms: function () {
            $(newTask_btn).toggleClass('active');
            $(editTask_charm).data('charms').toggle();
        },
        newTaskInit: function () {
            // 初始化new task 值
            this.editTask = JSON.parse(JSON.stringify(newTaskTemplate));
            // this.$forceUpdate();
        },
        classifyTime: function (subTask) {
            for (timeClassify of this.timeClassifys) {
                if (subTask.alarmTime >= timeClassify[1].start && subTask.alarmTime < timeClassify[1].end) {
                    subTask.timeClassify = timeClassify[0];
                    break;
                }
            }
        },
        hasClassify: function (timeClassify, subTasks) {
            for (subTask of subTasks) {
                if (subTask.timeClassify === timeClassify) {
                    return true;
                }
            }
            return false;
        },
        taskNearestSubTask: function (task) {
            var date = new Date();
            var year = date.getFullYear();
            var month = date.getMonth() + 1;
            var day = date.getDate();
            var currentDate = year + '-' + month + '-' + day;
            var currentTime = date.getTime();
            var subTaskNearSet = [];
            for (subTask of task.subTasks) {
                if (subTask.status != 'finished') {
                    var taskAlarmDateStr = currentDate + ' ' + subTask.alarmTime;
                    var taskAlarmDate = new Date(taskAlarmDateStr);
                    var taskAlarmTime = taskAlarmDate.getTime();
                    subTaskNearSet.push([subTask, Math.abs(taskAlarmTime - currentTime), subTask.alarmTime]);
                }
            }
            if (subTaskNearSet.length === 0) {
                return '';
            }
            subTaskNearSet.sort(function (a, b) { return a[1] - b[1] });
            return subTaskNearSet[0][0];
        },
        sortSubTask: function (subTasks) {
            // var date = new Date();
            // var year = date.getFullYear();
            // var month = date.getMonth() + 1;
            // var day = date.getDate();
            // var currentDate = year + '-' + month + '-' + day;
            // var subTaskNearSet = [];
            // for (subTask of subTasks) {
            //     var taskAlarmDateStr = currentDate + ' ' + subTask.alarmTime;
            //     var taskAlarmDate = new Date(taskAlarmDateStr);
            //     var taskAlarmTime = taskAlarmDate.getTime();
            //     subTaskNearSet.push([subTask, taskAlarmTime, subTask.alarmTime]);
            // }
            // subTaskNearSet.sort(function (a, b) { return a[1] - b[1] });
            // return subTaskNearSet;

            return subTasks.sort(function (a, b) {
                return (new Date().format("%d-%m-%Y ") + a.alarmTime).toDate("dd-mm-yyyy hh:ii:ss").getTime() - (new Date().format("%d-%m-%Y ") + b.alarmTime).toDate("dd-mm-yyyy hh:ii:ss").getTime()
            })
        },
        allTaskNearestSubTask: function () {
            if (this.damato.tasks.length === 0) {
                return '';
            }
            var date = new Date();
            var year = date.getFullYear();
            var month = date.getMonth() + 1;
            var day = date.getDate();
            var currentDate = year + '-' + month + '-' + day;
            var currentTime = date.getTime();
            var subTaskNearSet = [];
            for (task of this.damato.tasks) {
                for (subTask of task.subTasks) {
                    if (subTask.status != 'finished') {
                        var taskAlarmDateStr = currentDate + ' ' + subTask.alarmTime;
                        var taskAlarmDate = new Date(taskAlarmDateStr);
                        var taskAlarmTime = taskAlarmDate.getTime();
                        var timeDistance = taskAlarmTime - currentTime;
                        subTaskNearSet.push([subTask, Math.abs(timeDistance), subTask.alarmTime, task]);
                    }
                }
            }
            subTaskNearSet.sort(function (a, b) { return a[1] - b[1] });
            if (subTaskNearSet.length === 0) {
                return '';
            }
            return [subTaskNearSet[0][0], subTaskNearSet[0][3], subTaskNearSet[0][1]];
        },
        allTaskNearestComingSubTask: function () {
            if (this.damato.tasks.length === 0) {
                return '';
            }
            var date = new Date();
            var year = date.getFullYear();
            var month = date.getMonth() + 1;
            var day = date.getDate();
            var currentDate = year + '-' + month + '-' + day;
            var currentTime = date.getTime();
            var subTaskNearSet = [];
            for (task of this.damato.tasks) {
                for (subTask of task.subTasks) {
                    if (subTask.status != 'finished' && subTask.weatherAlarm) {
                        var taskAlarmDateStr = currentDate + ' ' + subTask.alarmTime;
                        var taskAlarmDate = new Date(taskAlarmDateStr);
                        var taskAlarmTime = taskAlarmDate.getTime();
                        var timeDistance = taskAlarmTime - currentTime;
                        if (timeDistance > 0) {
                            subTaskNearSet.push([subTask, timeDistance, subTask.alarmTime, task]);
                        }
                    }
                }
            }
            subTaskNearSet.sort(function (a, b) { return a[1] - b[1] });
            if (subTaskNearSet.length === 0) {
                return '';
            }
            return [subTaskNearSet[0][0], subTaskNearSet[0][3], subTaskNearSet[0][1]];
        },
        subTaskDo: function (subTask, task) {
            // alert(JSON.stringify(subTask));
            if (subTask.length === 0) {
                var notify = Metro.notify;
                notify.setup({
                    distance: 50,
                    width: 300,
                    duration: 1000,
                    animation: 'easeOutCubic'
                });
                notify.create("Congratulate! Todays [ " + task.title + " ] task has already been finished!", "", { cls: "success" });
                notify.reset();
            }
            var now = new Date();
            subTask.startTime = now.getTime();
            this.doSubTask = subTask;
            this.doTask = task;
        },
        taskFinish: function () {
            // count down component will finished icorrectely
            if ($('#countDown').data('countdown').getLeft().days === 0 && $('#countDown').data('countdown').getLeft().hours === 0 && $('#countDown').data('countdown').getLeft().minutes === 0 && $('#countDown').data('countdown').getLeft().seconds === 0) {
                this.doSubTask.status = 'finished';
                var notify = Metro.notify;
                notify.setup({
                    width: 300,
                    duration: 1000,
                    animation: 'easeOutBounce'
                });
                notify.create(this.doTask.title + " finished!", "");
                notify.reset();
                new Notification(this.doTask.title + " finished!", {
                    body: this.doTask.title + " " + this.doTask.subTitle + " finished!"
                });
                this.doSubTask = '';
                this.doTask = '';
                this.$forceUpdate();
            }
        },
        feedBackSubmit: function () {
            if (this.feedBackText) {
                Metro.toast.create("Feedback success, thanks for your attation.", null, 5000, "info");
            }
        },
        nearestSubTaskTimeNotifier: function () {
            clearTimeout(notifyTimer);
            var allTaskNearestSubTask = this.allTaskNearestComingSubTask();
            if (allTaskNearestSubTask.length > 0) {
                console.log("nearest sub task time distance" + allTaskNearestSubTask[2]);
                console.log("nearest sub task alarm time" + allTaskNearestSubTask[0].alarmTime);
                notifyTimer = setTimeout(function () {
                    new Notification(allTaskNearestSubTask[1].title, {
                        body: allTaskNearestSubTask[1].subTitle
                    });
                    app.nearestSubTaskTimeNotifier();
                }, allTaskNearestSubTask[2]);
            }
            this.$forceUpdate();
        },
        deleteSubTask: function (subTaskIndex) {
            this.editTask.subTasks.splice(subTaskIndex, 1);
            this.editTask.editTaskTimes--;
        },
    }
})