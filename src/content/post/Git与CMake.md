---
title: Git与CMake
publishDate: 2023-10-19 23:55:10
description: ' git和cmake相关内容'
language: '中文'
tags:
  - Git
  - CMake
  - Github
---
git和cmake相关内容
 
<!-- more -->
# Git与CMake

## CMake 基本使用方法

$\quad$ CMake是一个简单的工具，帮助我们从更抽象的角度来维护项目，而不需要去手动调整和键入编译指令等细碎的内容

### 一个简单的Example

$\quad$ 新建一个目录并进入该目录`mkdir Test && cd Test`，在该目录下创建文件`CMakeLists.txt`，并在该文件内输入如下的内容

```cmake

project (Test)

cmake_minimum_required(VERSION 3.10)

```

$\quad$ 这样一个最简单的CMake项目就建立完成了

为了测试CMake的功能，我们在这个目录下新建一个`main.cpp`的文件，内容如下

```cpp

#include <iostream>

int main(int argc, char **argv) {

std::cout << "Hello World" << std::endl;

return 0;

}

```

$\quad$ 修改`CMakeLists.txt`在末尾加入一行`add_executable(hello main.cpp)`这一行代码的意义在于：

1. 新建了一个hello的可执行程序

2. 这个hello的可执行程序代码由main.cpp这个**源文件**构成

$\quad$ 在该目录下新建一个`build`文件夹，进入这个文件夹并执行`cmake .. -G "Unix Makefiles"`

$\quad$ 这样，我们就在`build`目录下生成了Makefile的文件，只需要输入`make`即可进行编译，编译的结果也在`build`目录中

$\quad$ 此时我们应该能在`build`目录中找到一个叫做`hello`的可执行文件，和Make本身的作用相同，当我们修改了文件之后，只需要在`build`目录中重新执行`make`即可根据修改的文件重新编译

$\quad$ 当我们修改了`CMakeLists.txt`文件，但是我们不希望更改任何设置的时候，我们只需要在`build`目录中重新执行`cmake ..`即可(不用加任何参数)

### 添加头文件

$\quad$ 某些情况下（比如为了让文件夹更美观），我们可能会将源文件和头文件放到不同的文件夹中比如

```plain

- include

--- hello.hpp

- src

--- main.cpp

- CMakeLists.txt

```

  

$\quad$ 但是这样，我们就需要在`hello.cpp`中引用`hello.hpp`时使用`#include "../include/hello.hpp`

$\quad$ 为了解决这个问题，我们可以在编译选项中加入`-Iinclude`这个参数解决

在CMake中表现为，我们可以为某一个可执行文件添加一个include目录使用方法`target_include_directories`即可解决

以上面的文件夹结构为例我们可以在`CMakeLists.txt`中添加

```cmake

add_executable(hello src/main.cpp)

target_include_directories(hello PUBLIC include)

```

$\quad$ 这样我们就可以在`main.cpp`中使用`#include <hello.hpp>`了

### 库

#### 链接库

$\quad$ 我们可能经常使用别人的库，当需要进行链接的时候，我们会使用指令`-lXXX`这会让编译器从某些特定的路径中查找`libXXX.a`文件并进行链接

$\quad$ 对应在CMake中的命令为`target_link_libraries`

$\quad$ 同样以上面的内容为例子，假设一个我们要链接`libaaa.a`和`libbbb.a`，我们只需要使用`target_link_libraries(hello PUBLIC aaa bbb)`

#### 创建库

$\quad$ 另一种情况是我们希望使用自己创建的库我们可以使用指令`add_library`创建一个库

$\quad$ 文件目录为:

```plain

- main.cpp

- mylib.cpp

- CMakeLists.txt

```

$\quad$ `main.cpp`为

```cpp

void PrintHelloWorld();

int main() { PrintHelloWorld(); }

```

$\quad$ `mylib.cpp`为

```cpp

#include <iostream>

void PrintHelloWorld() {

std::cout << "Hello World" << std::endl;

}

```

$\quad$ 此时我们只需要像`add_executable`一样使用`add_library`即可创建一个库

```cmake

add_library(mlib mylib.cpp)

```

$\quad$ 使用指令`target_link_libraries(hello PUBLIC mlib)`即可

## Git

  

$\quad$ Git 是一个开源的分布式版本控制系统，常用于便捷高效地处理任何或大或小的项目。

### Git 基本操作

#### 创建仓库

$\quad$ `git init` 用于创建并初始化一个新的仓库，你可以在该仓库开始构建项目。

$\quad$ 在任意位置新建文件夹 `mkdir lab0` ，在该目录下执行 `git init` 会在该位置创建本地 git 仓库

```bash

mkdir lab0

cd lab0

git init

```

$\quad$ 除了新建一个仓库，你也可以使用 `git clone` 命令拷贝一个现有仓库，我们以 Lab0 的模板仓库为例，在任意位置执行以下指令

```bash

git clone https://github.com/N2Sys-EDU/Lab0-Introduction-To-Classroom.git

```

$\quad$ 这条指令将位于 `https://github.com/N2Sys-EDU/Lab0-Introduction-To-Classroom.git` 的远程仓库克隆到本地，你将会在当前目录下发现目录 `Lab0-Introduction-To-Classroom/`

#### 提交修改

$\quad$ 当你在项目中做了一些修改后，比如创建一个新文件 `touch README.md` ，你可以使用 `git add` 命令来将你的修改添加到暂存区，例如 `git add README.md` ，你也可以使用 `git add .` 来将所有修改添加到暂存区。

```bash

touch README.md

git add README.md

```

$\quad$ 在确认了你的改动之后，你可以将文件提交到仓库中，但在此之前，你需要先设置你的用户信息

```bash

git config --global user.name "labman008"

git config --global user.email "labman008@pku.edu.cn"

```

$\quad$ `--global` 用于指明作用域为全局，相应的你也可以使用 `--local` 来使得配置仅在当前仓库生效。

$\quad$ 之后，你可以使用 `git commit` 指令将暂存区的文件提交到本地仓库中，这将会在仓库中创建一个快照，或者说项目的一个版本，你可以利用 git 在不同版本之间快捷的切换，换言之你不用再担心因为反复修改而失去了第一份能运行的代码了。

```bash

git commit -m "first commit"

```

$\quad$ `git commit -m [message]` 用于为你的提交添加一些说明。另外，你也可以使用 `git commit -a` 来跳过 `git add`

### Github

$\quad$ Github 是一个在线软件软代码托管服务平台，使用 git 作为版本控制软件。截至 2022 年 6 月， github 已有超过 5700 万注册用户和 1.9 亿代码库（包括至少 2800 万开源代码库），是世界上最大的代码托管网站和开源社区。

#### 创建账号

$\quad$ 打开 [github官网](https://github.com/) ，点击右上角 `sign up` ，跟随指引创建你的 github 账号。

#### 创建仓库

$\quad$ 登入后点击左侧 New 或右上角加号 - `New repository` 新建一个仓库，键入仓库名和其他你觉得需要的信息后点击 `Create repository` 即可完成创建。

#### 配置 ssh key

$\quad$ 为了在本地仓库和远程仓库间进行传输的安全性，需要进行验证。我们推荐你使用 ssh 进行加密传输，为此你需要在 github 上添加你的 ssh 公钥。

##### 生成 SSH Key

$\quad$ 在本地使用 `ssh-keygen` 命令生成密钥。简单起见，这里我们使用 `ssh-keygen` 的默认生成方式，你可以查询该指令的参数来修改生成方式。

```bash

ssh-keygen

```

$\quad$ 你可以简单的键入三次回车来生成密钥，生成的密钥在 `~/.ssh/` 目录下。

##### 添加 SSH Key

$\quad$ 回到 github ，点击右上角头像 - `Settings` ，然后点击左侧 `SSH and GPG keys` 进入 ssh key 配置界面。点击 `New SSH key` 添加新的密钥。

$\quad$ 复制本地 `~/.ssh/id_rsa.pub` 中的 key 粘贴进 `Key` 中，在 `Title` 一栏你可以为该密钥命名。

$\quad$ 在 linux 上你可以使用

```bash

cat ~/.ssh/id_rsa.pub

```

$\quad$ 获取生成的公钥。

$\quad$ 输入完后，点击 `Add SSH key` 完成添加。

$\quad$ 你可以在本地执行

```bash

ssh -T git@github.com

```

$\quad$ 来测试是否添加成功。

#### 克隆仓库到本地

$\quad$ 打开你想要 clone 的远程仓库，比如 classroom 自动新建的你的 lab0 仓库，点击绿色的 `Code` 按钮，选择 `SSH` ，复制下方的链接。

在本地执行

```bash

git clone git@github.com:N2Sys-EDU/lab0-introduction-xxx.git

```

$\quad$ 将 clone 后的链接换成刚刚复制的链接，如果之前的配置正确，你将在本地看到 clone 下来的本地仓库。最后，我们需要在本地仓库和远程仓库间进行同步。

##### push

$\quad$ 你可以通过 `git push` 命令将本地仓库推送到远端。注意，只有已提交的更改才会被推送。即，假设你修改了 lab0 仓库中的 hellonetwowrk.cpp 文件，那么你可以通过以下指令更新远程仓库

```bash

git add hellonetwork.cpp

git commit -m "hellonetwork"

git push

```

$\quad$ 或者简单的使用

```bash

git commit -am "hellonetwork"

git push

```

##### pull

$\quad$ 你可以通过 `git pull` 命令将远端仓库的更新拉取到本地。这主要用于合作开发或者使用多台设备进行开发。

```bash

git pull

```

##### branch

$\quad$ 你可以通过 `git branch` 命令来基于当前版本创建一个新的分支，不同的分支创建后互相独立。之后，你可以通过 `git checkout` 命令来切换分支。举例来说，

```bash

git branch new-branch

git checkout new-branch

```

$\quad$ 对分支 new-branch 的修改不会影响到原分支，同样的，对原分支的修改将不再影响 new-branch 你可以再次执行 `git checkout main` 回到原分支， `main` 是 github 的默认分支。

$\quad$ 另外，你可以通过 `git merge` 命令合并两个分支。

##### reset

$\quad$ `reset` 命令用于版本回滚，即回退到提交过的某一版本

  
  
  
  

---