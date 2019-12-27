const { ipcRenderer } = require('electron')

// 全局变量
var notifyTimer;
var newSubTaskTemplate = { 'id': 0, 'alarmTime': '09:00:00', 'continueTime': '00:15:00', 'weatherAlarm': true, 'status': '', 'startTime': '', 'timeClassify': '' };
var newTaskTemplate = { 'editTaskTimes': 1, 'editTaskContinueTime': '00:15:00', 'id': '', 'title': '', 'subTitle': '', 'subTasks': [newSubTaskTemplate] };
var archivedDamatos = require('electron').remote.getGlobal('archivedDamatos');

var app = new Vue({
    el: '#app',
    data: {
        currentPage: 0,
        damato: '',
        timeClassifys: [['morning', { 'start': '06:00:00', 'end': '09:00:00' }], ['foreNoon', { 'start': '09:00:00', 'end': '12:00:00' }], ['noon', { 'start': '12:00:00', 'end': '14:00:00' }], ['afterNoon', { 'start': '14:00:00', 'end': '19:00:00' }], ['night', { 'start': '19:00:00', 'end': '24:00:00' }], ['other', { 'start': '00:00:00', 'end': '06:00:00' }]],
        editTask: { 'editTaskTimes': 1, 'editTaskContinueTime': '00:15:00', 'id': '', 'title': '', 'subTitle': '', 'subTasks': [newSubTaskTemplate] },
        doTask: '',
        doSubTask: '',
        viewDamatos: '',
        viewDetailDamato: '',
        archivedDamatosMax: '',
        archivedDamatosMin: '',
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
        this.loadArchivedDamatos(new Date());
        // this.viewDetailDamato = this.viewDamatos[dateFormat(new Date())];
        this.nearestSubTaskTimeNotifier();
        this.computeArchivedDamatoMaxMin();
    },
    mounted: function () {
        Metro.init();
    },
    methods: {
        tasksFinishedStatus: function (damato) {
            var finishedCount = 0;
            var unFinishedCount = 0;
            for (task of damato.tasks) {
                finishedCount += this.taskFinishedStatus(task).finishedCount;
                unFinishedCount += this.taskFinishedStatus(task).unFinishedCount;
                // for (subTask of task.subTasks) {
                //     if (subTask.status === 'finished') {
                //         finishedCount++;
                //     } else {
                //         unFinishedCount++;
                //     }
                // }
            }
            return { 'finishedCount': finishedCount, 'unFinishedCount': unFinishedCount };
        },
        taskFinishedStatus: function (task) {
            var finishedCount = 0;
            var unFinishedCount = 0;
            var finishedTime = 0;
            var unFinishedTime = 0;
            for (subTask of task.subTasks) {
                if (subTask.status === 'finished') {
                    finishedCount++;
                    finishedTime += timeToSeconds(subTask.continueTime);
                } else {
                    unFinishedCount++;
                    unFinishedTime += timeToSeconds(subTask.continueTime);
                }
            }
            return { 'finishedCount': finishedCount, 'unFinishedCount': unFinishedCount, 'finishedTime': finishedTime, 'unFinishedTime': unFinishedTime };
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
        computeArchivedDamatoMaxMin: function () {
            let arr = [];
            for (let i in global.archivedDamatos) { arr.push(i) };
            function sortDateF(dateA, dateB) {
                return (dateB.split("-")[0] * 12 * 30 + dateB.split("-")[1] * 12 + dateB.split("-")[2]) - (dateA.split("-")[0] * 12 * 30 + dateA.split("-")[1] * 12 + dateA.split("-")[2])
            }
            arr.sort(sortDateF);
            this.archivedDamatosMax = arr[0];
            this.archivedDamatosMin = arr[arr.length - 1];
        },
        loadArchivedDamatos: function (queryDate) {
            var targetDamatos = new Object();
            var startDate = getFirstDayOfWeek(queryDate);
            var queryDate = new Date(queryDate);
            targetDamatos[dateFormat(startDate)] = undefined;
            if (global.archivedDamatos[dateFormat(startDate)] === undefined && startDate < new Date()) {
                let arr = [];
                for (let i in global.archivedDamatos) { arr.push(i) };
                function sortDateF(dateA, dateB) {
                    return (dateB.split("-")[0] * 12 * 30 + dateB.split("-")[1] * 12 + dateB.split("-")[2]) - (dateA.split("-")[0] * 12 * 30 + dateA.split("-")[1] * 12 + dateA.split("-")[2])
                }
                arr.sort(sortDateF);
                // this.archivedDamatosMax = arr[0];
                // this.archivedDamatosMin = arr[arr.length - 1];
                for (let i of arr) {
                    if (sortDateF(i, dateFormat(startDate)) > 0) {
                        targetDamatos[dateFormat(startDate)] = cleanFinisheStatus(global.archivedDamatos[i], dateFormat(startDate));
                        break;
                    }
                }
            } else {
                targetDamatos[dateFormat(startDate)] = global.archivedDamatos[dateFormat(startDate)]
            }
            for (var i = 1; i < 7; i++) {
                if (global.archivedDamatos[dateChange(i, dateFormat(startDate))] === undefined && dateChange(i, dateFormat(startDate)) <= dateFormat(new Date())) {
                    if (dateChange(i, dateFormat(startDate)) == dateFormat(new Date())) {
                        targetDamatos[dateChange(i, dateFormat(startDate))] = this.damato;
                    } else {
                        targetDamatos[dateChange(i, dateFormat(startDate))] = cleanFinisheStatus(targetDamatos[dateChange(i - 1, dateFormat(startDate))], dateChange(i, dateFormat(startDate)));
                    }
                } else {
                    targetDamatos[dateChange(i, dateFormat(startDate))] = global.archivedDamatos[dateChange(i, dateFormat(startDate))];
                }
            }
            // if (dateFormat(queryDate) == dateFormat(new Date())) {
            //     targetDamatos[dateFormat(queryDate)] = this.damato;
            // }
            this.viewDamatos = targetDamatos;
            this.viewDetailDamato = targetDamatos[dateFormat(queryDate)];
        },
        viewDamatosCount: function () {
            var finishedCount = [];
            var unFinishedCount = [];
            for (damato in this.viewDamatos) {
                if (this.viewDamatos[damato] != undefined) {
                    var damatoFinishedCount = this.tasksFinishedStatus(this.viewDamatos[damato])["finishedCount"];
                    var damatoUnFinishedCount = this.tasksFinishedStatus(this.viewDamatos[damato])["unFinishedCount"];
                    finishedCount.push(damatoFinishedCount);
                    unFinishedCount.push(damatoUnFinishedCount);
                } else {
                    finishedCount.push(0);
                    unFinishedCount.push(0);
                }
            }
            return { "finishedCount": finishedCount, "unFinishedCount": unFinishedCount };
        },
        viewTasksCount: function () {
            var finishedCount = [];
            var unFinishedCount = [];
            var labels = [];
            for (task of this.viewDetailDamato.tasks) {
                if (task != undefined) {
                    var damatoFinishedCount = this.taskFinishedStatus(task)["finishedCount"];
                    var damatoUnFinishedCount = this.taskFinishedStatus(task)["unFinishedCount"];
                    finishedCount.push(damatoFinishedCount);
                    unFinishedCount.push(damatoUnFinishedCount);
                    labels.push(task.title)
                }
            }
            return { "finishedCount": finishedCount, "unFinishedCount": unFinishedCount, "labels": labels };
        },
        updateChartData: function (date = false) {
            if (date) {
                this.loadArchivedDamatos(date);
            }
            weekChart.data.datasets[0].data = this.viewDamatosCount()["finishedCount"];
            weekChart.data.datasets[1].data = this.viewDamatosCount()["unFinishedCount"];
            weekChart.update();
            dayChart.data.labels = this.viewTasksCount()["labels"];
            dayChart.data.datasets[0].data = this.viewTasksCount()["finishedCount"];
            dayChart.data.datasets[1].data = this.viewTasksCount()["unFinishedCount"];
            dayChart.update();
        },
        viewDayChange: function (dataModifyDay) {
            var changeToDate = dateChange(dataModifyDay, dateFormat(new Date(app.viewDetailDamato.createTime)));
            if (new Date(changeToDate) > new Date()) {
                this.updateChartData(new Date());
            } else if (new Date(changeToDate) < new Date(this.archivedDamatosMin)) {
                this.updateChartData(new Date(this.archivedDamatosMin));
            } else {
                this.updateChartData(new Date(changeToDate));
            }
        },
        dateFormat: function (date) {
            return date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate();
        },
        t: function () {
            alert('111');
        }
    }
})

function dateFormat(date) {
    return date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate();
}

function dateChange(num = 0, date = false) {
    if (!date) {
        date = new Date();//没有传入值时,默认是当前日期
        date = dateFormat(date)
    }
    date += " 00:00:00";//设置为当天凌晨12点
    date = Date.parse(new Date(date)) / 1000;//转换为时间戳
    date += (86400) * num;//修改后的时间戳
    var newDate = new Date(parseInt(date) * 1000);//转换为时间
    return newDate.getFullYear() + '-' + (newDate.getMonth() + 1) + '-' + newDate.getDate();
}

function getFirstDayOfWeek(date) {
    var resultDate = new Date(date);
    var weekday = resultDate.getDay() || 7; //获取星期几,getDay()返回值是 0（周日） 到 6（周六） 之间的一个整数。0||7为7，即weekday的值为1-7
    resultDate.setDate(resultDate.getDate() - weekday + 1);//往前算（weekday-1）天，年份、月份会自动变化
    return resultDate;
}

function timeToSeconds(timeS) {
    // 时间转秒
    return timeS.split(":")[0] * 3600 + timeS.split(":")[1] * 60 + timeS.split(":")[2] * 1
}
function formatZero(num, len) {
    // 数字补位
    if (String(num).length > len) return num;
    return (Array(len).join(0) + num).slice(-len);
}
function secondsToTime(seconds) {
    // 秒转时间
    return formatZero(Math.floor(seconds / 3600), 2) + ":" + formatZero(Math.floor(seconds % 3600 / 60), 2) + ":" + formatZero(seconds % 3600 % 60, 2);
}

function cleanFinisheStatus(damato, date) {
    var resultDamato = JSON.parse(JSON.stringify(damato));
    for (task of resultDamato.tasks) {
        for (subTask of task.subTasks) {
            if (subTask.status == 'finished') {
                subTask.status = '';
            }
        }
    }
    resultDamato.createTime = new Date().setFullYear(date.split("-")[0] - 0, date.split("-")[1] - 1, date.split("-")[2] - 0);
    return resultDamato;
}

// 统计图初始化
var weekCtx = document.getElementById("chart_week").getContext("2d");
var data = {
    labels: ["Mon", "Tues", "Wed", "Thur", "Fri", "Sat", "Sun"],
    datasets: [
        {
            label: "Task finished count",
            backgroundColor: [
                'rgba(153, 102, 255, 0.2)',
                'rgba(153, 102, 255, 0.2)',
                'rgba(153, 102, 255, 0.2)',
                'rgba(153, 102, 255, 0.2)',
                'rgba(153, 102, 255, 0.2)',
                'rgba(153, 102, 255, 0.2)'
            ],
            borderColor: [
                'rgba(153, 102, 255, 1)',
                'rgba(153, 102, 255, 1)',
                'rgba(153, 102, 255, 1)',
                'rgba(153, 102, 255, 1)',
                'rgba(153, 102, 255, 1)',
                'rgba(153, 102, 255, 1)'
            ],
            data: [65, 59, 80, 81, 56, 55, 40]
        },
        {
            label: "Task unfinished count",
            data: [28, 48, 40, 19, 86, 27, 90]
        }
    ]
};
var weekChart = new Chart(weekCtx, {
    type: 'bar',
    data: data,
})
$(chart_week).on("click", function (evt) {
    var activeBars = weekChart.getElementAtEvent(evt);
    if (activeBars.length > 0) {
        var datasetsIndex = activeBars[0]._datasetIndex;
        var barIndex = activeBars[0]._index;
        var startDate = getFirstDayOfWeek(app.viewDetailDamato.createTime);
        var viewDate = dateChange(barIndex, dateFormat(new Date(startDate)));
        app.updateChartData(new Date().setFullYear(viewDate.split("-")[0] - 0, viewDate.split("-")[1] - 1, viewDate.split("-")[2] - 0));
        // console.log(datasetsIndex+barIndex);
    }
    // console.log(activeBars);
    // => activeBars is an array of bars on the canvas that are at the same position as the click event.
})

var dayCtx = document.getElementById("chart_day").getContext("2d");
var data = {
    labels: ["Mon", "Tues", "Wed", "Thur", "Fri", "Sat", "Sun"],
    datasets: [
        {
            label: "Task finished count",
            backgroundColor: [
                'rgba(153, 102, 255, 0.2)',
                'rgba(153, 102, 255, 0.2)',
                'rgba(153, 102, 255, 0.2)',
                'rgba(153, 102, 255, 0.2)',
                'rgba(153, 102, 255, 0.2)',
                'rgba(153, 102, 255, 0.2)'
            ],
            borderColor: [
                'rgba(153, 102, 255, 0.2)',
                'rgba(153, 102, 255, 0.2)',
                'rgba(153, 102, 255, 0.2)',
                'rgba(153, 102, 255, 0.2)',
                'rgba(153, 102, 255, 0.2)',
                'rgba(153, 102, 255, 0.2)'
            ],
            data: [65, 59, 80, 81, 56, 55, 40]
        },
        {
            label: "Task unfinished count",
            data: [28, 48, 40, 19, 86, 27, 90]
        }
    ]
};
var dayChart = new Chart(dayCtx, {
    type: 'bar',
    data: data,
})
