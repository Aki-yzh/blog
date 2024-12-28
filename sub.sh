#!/bin/bash

# 提示用户输入提交信息
echo "请输入提交信息："
read commit_message

# 执行 git 命令
git add .
git commit -m "$commit_message"
git push