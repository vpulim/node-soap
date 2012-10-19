#include <node.h>
#include <node_version.h>
#include <node_object_wrap.h>
#include <node_buffer.h>
extern "C" {
#include <expat.h>
}

using namespace v8;
using namespace node;

static Persistent<String> sym_startElement, sym_endElement,
  sym_startCdata, sym_endCdata,
  sym_text, sym_processingInstruction,
  sym_comment, sym_xmlDecl, sym_entityDecl,
  sym_emit;

class Parser : public ObjectWrap {
public:
  static void Initialize(Handle<Object> target)
  {
    HandleScope scope;
    Local<FunctionTemplate> t = FunctionTemplate::New(New);

    t->InstanceTemplate()->SetInternalFieldCount(1);

    NODE_SET_PROTOTYPE_METHOD(t, "parse", Parse);
    NODE_SET_PROTOTYPE_METHOD(t, "setEncoding", SetEncoding);
    NODE_SET_PROTOTYPE_METHOD(t, "getError", GetError);
    NODE_SET_PROTOTYPE_METHOD(t, "stop", Stop);
    NODE_SET_PROTOTYPE_METHOD(t, "resume", Resume);
    NODE_SET_PROTOTYPE_METHOD(t, "reset", Reset);
    NODE_SET_PROTOTYPE_METHOD(t, "getCurrentLineNumber", GetCurrentLineNumber);
    NODE_SET_PROTOTYPE_METHOD(t, "getCurrentColumnNumber", GetCurrentColumnNumber);
    NODE_SET_PROTOTYPE_METHOD(t, "getCurrentByteIndex", GetCurrentByteIndex);

    target->Set(String::NewSymbol("Parser"), t->GetFunction());

    sym_startElement = NODE_PSYMBOL("startElement");
    sym_endElement = NODE_PSYMBOL("endElement");
    sym_startCdata = NODE_PSYMBOL("startCdata");
    sym_endCdata = NODE_PSYMBOL("endCdata");
    sym_text = NODE_PSYMBOL("text");
    sym_processingInstruction = NODE_PSYMBOL("processingInstruction");
    sym_comment = NODE_PSYMBOL("comment");
    sym_xmlDecl = NODE_PSYMBOL("xmlDecl");
    sym_entityDecl = NODE_PSYMBOL("entityDecl");
    sym_emit = NODE_PSYMBOL("emit");
  }

protected:
  /*** Constructor ***/

  static Handle<Value> New(const Arguments& args)
  {
    HandleScope scope;
    XML_Char *encoding = NULL;
    if (args.Length() == 1 && args[0]->IsString())
      {
        encoding = new XML_Char[32];
        args[0]->ToString()->WriteAscii(encoding, 0, 32);
      }

    Parser *parser = new Parser(encoding);
    if (encoding)
      delete[] encoding;
    parser->Wrap(args.This());
    return args.This();
  }

  Parser(const XML_Char *encoding)
    : ObjectWrap()
  {
    parser = XML_ParserCreate(encoding);
    assert(parser != NULL);

    attachHandlers();
  }

  ~Parser()
  {
    XML_ParserFree(parser);
  }

  void attachHandlers()
  {
    XML_SetUserData(parser, this);
    XML_SetElementHandler(parser, StartElement, EndElement);
    XML_SetCharacterDataHandler(parser, Text);
    XML_SetCdataSectionHandler(parser, StartCdata, EndCdata);
    XML_SetProcessingInstructionHandler(parser, ProcessingInstruction);
    XML_SetCommentHandler(parser, Comment);
    XML_SetXmlDeclHandler(parser, XmlDecl);
    XML_SetEntityDeclHandler(parser, EntityDecl);
  }
    
  /*** parse() ***/

  static Handle<Value> Parse(const Arguments& args)
  {
    Parser *parser = ObjectWrap::Unwrap<Parser>(args.This());
    HandleScope scope;
    Local<String> str;
    int isFinal = 0;

    /* Argument 2: isFinal :: Bool */
    if (args.Length() >= 2)
      {
        isFinal = args[1]->IsTrue();
      }

    /* Argument 1: buf :: String or Buffer */
    if (args.Length() >= 1 && args[0]->IsString())
      {
        str = args[0]->ToString();
        return scope.Close(parser->parseString(**str, isFinal) ? True() : False());
      }
    else if (args.Length() >= 1 && args[0]->IsObject())
      {
        Local<Object> obj = args[0]->ToObject();
        if (Buffer::HasInstance(obj))
        {
#if NODE_MAJOR_VERSION == 0 && NODE_MINOR_VERSION < 3
          Buffer *buffer = ObjectWrap::Unwrap<Buffer>(obj);
          return scope.Close(parser->parseBuffer(*buffer, isFinal) ? True() : False());
#else
          return scope.Close(parser->parseBuffer(obj, isFinal) ? True() : False());
#endif
        }
        else
          return ThrowException(
            Exception::TypeError(
              String::New("Parse buffer must be String or Buffer")));
      }
    else
      return ThrowException(
        Exception::TypeError(
          String::New("Parse buffer must be String or Buffer")));
  }

  /** Parse a v8 String by first writing it to the expat parser's
      buffer */
  bool parseString(String &str, int isFinal)
  {
    int len = str.Utf8Length();
    if (len == 0)
      return true;

    void *buf = XML_GetBuffer(parser, len);
    assert(buf != NULL);
    assert(str.WriteUtf8(static_cast<char *>(buf), len) == len);

    return XML_ParseBuffer(parser, len, isFinal) != XML_STATUS_ERROR;
  }

  /** Parse a node.js Buffer directly */
#if NODE_MAJOR_VERSION == 0 && NODE_MINOR_VERSION < 3
  bool parseBuffer(Buffer &buffer, int isFinal)
  {
    return XML_Parse(parser, buffer.data(), buffer.length(), isFinal) != XML_STATUS_ERROR;
  }
#else
  bool parseBuffer(Local<Object> buffer, int isFinal)
  {
    return XML_Parse(parser, Buffer::Data(buffer), Buffer::Length(buffer), isFinal) != XML_STATUS_ERROR;
  }
#endif

  /*** setEncoding() ***/

  static Handle<Value> SetEncoding(const Arguments& args)
  {
    Parser *parser = ObjectWrap::Unwrap<Parser>(args.This());
    HandleScope scope;

    if (args.Length() == 1 && args[0]->IsString())
      {
        XML_Char *encoding = new XML_Char[32];
        args[0]->ToString()->WriteAscii(encoding, 0, 32);

        int status = parser->setEncoding(encoding);

        delete[] encoding;

        return scope.Close(status ? True() : False());
      }
    else
      return False();
  }

  int setEncoding(XML_Char *encoding)
  {
    return XML_SetEncoding(parser, encoding) != 0;
  }

  /*** getError() ***/

  static Handle<Value> GetError(const Arguments& args)
  {
    HandleScope scope;
    Parser *parser = ObjectWrap::Unwrap<Parser>(args.This());

    const XML_LChar *error = parser->getError();
    if (error)
      return scope.Close(String::New(error));
    else
      return scope.Close(Null());
  }
  
  /*** stop() ***/

  static Handle<Value> Stop(const Arguments& args)
  {
    Parser *parser = ObjectWrap::Unwrap<Parser>(args.This());
    HandleScope scope;

    int status = parser->stop();
    
    return scope.Close(status ? True() : False());
  }

  int stop()
  {
    return XML_StopParser(parser, XML_TRUE) != 0;
  }
  
  /*** resume() ***/

  static Handle<Value> Resume(const Arguments& args)
  {
    Parser *parser = ObjectWrap::Unwrap<Parser>(args.This());
    HandleScope scope;

    int status = parser->resume();
    
    return scope.Close(status ? True() : False());
  }

  int resume()
  {
    return XML_ResumeParser(parser) != 0;
  }
  
  static Handle<Value> Reset(const Arguments& args)
  {
    Parser *parser = ObjectWrap::Unwrap<Parser>(args.This());
    HandleScope scope;
    XML_Char *encoding = NULL;
    if (args.Length() == 1 && args[0]->IsString())
      {
        encoding = new XML_Char[32];
        args[0]->ToString()->WriteAscii(encoding, 0, 32);
      }

    int status = parser->reset(encoding);
    if (status) 
      parser->attachHandlers();
    return scope.Close(status ? True() : False());
  }

  int reset(XML_Char *encoding)
  {
      return XML_ParserReset(parser, encoding) != 0;
  }
  const XML_LChar *getError()
  {
    enum XML_Error code;
    code = XML_GetErrorCode(parser);
    return XML_ErrorString(code);
  }

  static Handle<Value> GetCurrentLineNumber(const Arguments& args)
  {
    Parser *parser = ObjectWrap::Unwrap<Parser>(args.This());
    HandleScope scope;

    return scope.Close(Integer::NewFromUnsigned(parser->getCurrentLineNumber()));
  }

  uint32_t getCurrentLineNumber()
  {
    return XML_GetCurrentLineNumber(parser);
  }

  static Handle<Value> GetCurrentColumnNumber(const Arguments& args)
  {
    Parser *parser = ObjectWrap::Unwrap<Parser>(args.This());
    HandleScope scope;

    return scope.Close(Integer::NewFromUnsigned(parser->getCurrentColumnNumber()));
  }

  uint32_t getCurrentColumnNumber()
  {
    return XML_GetCurrentColumnNumber(parser);
  }

  static Handle<Value> GetCurrentByteIndex(const Arguments& args)
  {
    Parser *parser = ObjectWrap::Unwrap<Parser>(args.This());
    HandleScope scope;

    return scope.Close(Integer::New(parser->getCurrentByteIndex()));
  }

  int32_t getCurrentByteIndex()
  {
    return XML_GetCurrentByteIndex(parser);
  }

private:
  /* expat instance */
  XML_Parser parser;

  /* no default ctor */
  Parser();
        
  /*** SAX callbacks ***/
  /* Should a local HandleScope be used in those callbacks? */

  static void StartElement(void *userData,
                           const XML_Char *name, const XML_Char **atts)
  {
    Parser *parser = reinterpret_cast<Parser *>(userData);

    /* Collect atts into JS object */
    Local<Object> attr = Object::New();
    for(const XML_Char **atts1 = atts; *atts1; atts1 += 2)
      attr->Set(String::New(atts1[0]), String::New(atts1[1]));

    /* Trigger event */
    Handle<Value> argv[3] = { sym_startElement,
                              String::New(name),
                              attr };
    parser->Emit(3, argv);
  }

  static void EndElement(void *userData,
                         const XML_Char *name)
  {
    Parser *parser = reinterpret_cast<Parser *>(userData);

    /* Trigger event */
    Handle<Value> argv[2] = { sym_endElement, String::New(name) };
    parser->Emit(2, argv);
  }
  
  static void StartCdata(void *userData)
  {
    Parser *parser = reinterpret_cast<Parser *>(userData);

    /* Trigger event */
    Handle<Value> argv[1] = { sym_startCdata };
    parser->Emit(1, argv);
  }

  static void EndCdata(void *userData)
  {
    Parser *parser = reinterpret_cast<Parser *>(userData);

    /* Trigger event */
    Handle<Value> argv[1] = { sym_endCdata };
    parser->Emit(1, argv);
  }

  static void Text(void *userData,
                   const XML_Char *s, int len)
  {
    Parser *parser = reinterpret_cast<Parser *>(userData);

    /* Trigger event */
    Handle<Value> argv[2] = { sym_text,
                              String::New(s, len) };
    parser->Emit(2, argv);
  }

  static void ProcessingInstruction(void *userData,
                                    const XML_Char *target, const XML_Char *data)
  {
    Parser *parser = reinterpret_cast<Parser *>(userData);

    /* Trigger event */
    Handle<Value> argv[3] = { sym_processingInstruction,
                              String::New(target),
                              String::New(data) };
    parser->Emit(3, argv);
  }

  static void Comment(void *userData,
                      const XML_Char *data)
  {
    Parser *parser = reinterpret_cast<Parser *>(userData);

    /* Trigger event */
    Handle<Value> argv[2] = { sym_comment, String::New(data) };
    parser->Emit(2, argv);
  }

  static void XmlDecl(void *userData,
                      const XML_Char *version, const XML_Char *encoding,
                      int standalone)
  {
    Parser *parser = reinterpret_cast<Parser *>(userData);

    /* Trigger event */
    Handle<Value> argv[4] = { sym_xmlDecl,
                              version ? String::New(version) : Null(),
                              encoding ? String::New(encoding) : Null(),
                              Boolean::New(standalone) };
    parser->Emit(4, argv);
  }

  static void EntityDecl(void *userData, const XML_Char *entityName, int is_parameter_entity,
                         const XML_Char *value, int value_length, const XML_Char *base,
                         const XML_Char *systemId, const XML_Char *publicId, const XML_Char *notationName)
  {
    Parser *parser = reinterpret_cast<Parser *>(userData);

    /* Trigger event */
    Handle<Value> argv[8] = { sym_entityDecl,
                              entityName ? String::New(entityName) : Null(),
                              Boolean::New(is_parameter_entity),
                              value ? String::New(value, value_length) : Null(),
                              base ? String::New(base) : Null(),
                              systemId ? String::New(systemId) : Null(),
                              publicId ? String::New(publicId) : Null(),
                              notationName ? String::New(notationName) : Null(),
    };
    parser->Emit(8, argv);
  }

  void Emit(int argc, Handle<Value> argv[])
  {
    HandleScope scope;

    Local<Function> emit = Local<Function>::Cast(handle_->Get(sym_emit));
    emit->Call(handle_, argc, argv);
  }
};

extern "C" {
  static void init (Handle<Object> target)
  {
    Parser::Initialize(target);
  }
  //Changed the name cause I couldn't load the module with - in their names
  NODE_MODULE(node_expat, init);
};
